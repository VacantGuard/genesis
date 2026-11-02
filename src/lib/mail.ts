import { mkdirSync, writeFileSync } from "node:fs";
import { connect as netConnect, type Socket } from "node:net";
import path from "node:path";
import { connect as tlsConnect, type TLSSocket } from "node:tls";

export type MailMessage = { to: string; subject: string; text: string; replyTo?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mailReplyAddress() {
  const value = process.env.SMTP_REPLY_TO?.trim() ?? "";
  if (!value || /[\r\n]/.test(value) || !EMAIL.test(value)) return "";
  return value;
}

type SmtpSettings = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
};

function smtpSettings(): SmtpSettings | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const from = process.env.SMTP_FROM?.trim() ?? "";
  if (!host || !from) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isFinite(port) || port <= 0) return null;
  return {
    host,
    port,
    user: process.env.SMTP_USER?.trim() ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from,
    secure: process.env.SMTP_SECURE === "1" || port === 465,
  };
}

function mailbox(value: string) {
  const match = value.match(/<([^<>]+)>/);
  return (match ? match[1] : value).trim();
}

class SmtpSession {
  private pending = "";
  private waiters: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];

  constructor(private socket: Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.pending += chunk;
      this.drain();
    });
    socket.on("error", (error) => {
      const wrapped = error instanceof Error ? error : new Error("The mail server connection failed.");
      for (const waiter of this.waiters.splice(0)) waiter.reject(wrapped);
    });
  }

  private drain() {
    while (this.waiters.length) {
      const idx = this.pending.indexOf("\r\n");
      if (idx < 0) return;
      const line = this.pending.slice(0, idx);
      this.pending = this.pending.slice(idx + 2);
      this.waiters.shift()?.resolve(line);
    }
  }

  private line() {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The mail server did not respond.")), 15_000);
      this.waiters.push({
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.drain();
    });
  }

  async response() {
    const lines = [await this.line()];
    while (lines.at(-1)?.[3] === "-") lines.push(await this.line());
    return lines;
  }

  command(line: string) {
    this.socket.write(`${line}\r\n`);
  }

  write(body: string) {
    this.socket.write(body);
  }

  close() {
    this.socket.end();
  }

  destroy() {
    this.socket.destroy();
  }

  upgrade(host: string) {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    return new Promise<SmtpSession>((resolve, reject) => {
      const secure = tlsConnect({ socket: this.socket, servername: host });
      secure.once("secureConnect", () => resolve(new SmtpSession(secure)));
      secure.once("error", reject);
    });
  }
}

function openSmtp(settings: SmtpSettings) {
  return new Promise<SmtpSession>((resolve, reject) => {
    const socket = settings.secure
      ? tlsConnect({ host: settings.host, port: settings.port, servername: settings.host })
      : netConnect({ host: settings.host, port: settings.port });
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.once("error", fail);
    const ready = () => {
      socket.off("error", fail);
      resolve(new SmtpSession(socket));
    };
    if (settings.secure) (socket as TLSSocket).once("secureConnect", ready);
    else socket.once("connect", ready);
  });
}

async function expect(session: SmtpSession, code: string) {
  const lines = await session.response();
  if (!lines[0]?.startsWith(code)) {
    throw new Error(`Mail server said ${lines[0] || "nothing"}.`);
  }
  return lines;
}

async function smtpSend(settings: SmtpSettings, message: MailMessage) {
  const from = mailbox(settings.from);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) throw new Error("SMTP_FROM is not an email address.");
  let session = await openSmtp(settings);
  try {
    await expect(session, "220");
    session.command("EHLO localhost");
    let ehlo = await expect(session, "250");
    const offersTls = ehlo.some((line) => line.toUpperCase().includes("STARTTLS"));
    if (!settings.secure && offersTls) {
      session.command("STARTTLS");
      await expect(session, "220");
      session = await session.upgrade(settings.host);
      session.command("EHLO localhost");
      ehlo = await expect(session, "250");
    } else if (!settings.secure && settings.user) {
      throw new Error("The mail server does not offer a secure connection.");
    }
    if (settings.user) {
      session.command("AUTH LOGIN");
      await expect(session, "334");
      session.command(Buffer.from(settings.user).toString("base64"));
      await expect(session, "334");
      session.command(Buffer.from(settings.pass).toString("base64"));
      await expect(session, "235");
    }
    session.command(`MAIL FROM:<${from}>`);
    await expect(session, "250");
    session.command(`RCPT TO:<${message.to}>`);
    await expect(session, "250");
    session.command("DATA");
    await expect(session, "354");
    const text = message.text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    const headers = [`From: ${settings.from}`, `To: ${message.to}`, `Subject: ${message.subject}`];
    if (message.replyTo) headers.push(`Reply-To: ${message.replyTo}`);
    headers.push("Content-Type: text/plain; charset=utf-8", "", text, ".", "");
    session.write(headers.join("\r\n"));
    await expect(session, "250");
    session.command("QUIT");
    session.close();
  } catch (error) {
    session.destroy();
    throw error;
  }
}

export async function sendMail(
  message: MailMessage,
  options?: { logName?: string },
): Promise<{ ok: true; mode: "sent" | "logged" } | { ok: false; error: string }> {
  const replyTo = message.replyTo?.trim() || mailReplyAddress();
  if (/[\r\n]/.test(message.to) || /[\r\n]/.test(message.subject) || !EMAIL.test(message.to)) {
    return { ok: false, error: "That email address cannot be used." };
  }
  if (replyTo && (/[\r\n]/.test(replyTo) || !EMAIL.test(replyTo))) {
    return { ok: false, error: "That email address cannot be used." };
  }
  const outgoing = replyTo ? { ...message, replyTo } : message;
  const smtp = smtpSettings();
  if (smtp) {
    try {
      await smtpSend(smtp, outgoing);
      return { ok: true, mode: "sent" };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Email failed.";
      return { ok: false, error: detail };
    }
  }
  if (process.env.VERCEL) {
    return { ok: false, error: "Email is not set up, so nothing was sent." };
  }
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const file = options?.logName?.replace(/[^\w.-]/g, "") || "last-mail.txt";
  const replyLine = outgoing.replyTo ? `Reply-To: ${outgoing.replyTo}\n` : "";
  writeFileSync(
    path.join(dir, file),
    `To: ${outgoing.to}\n${replyLine}Subject: ${outgoing.subject}\n\n${outgoing.text}\n`,
    "utf8",
  );
  return { ok: true, mode: "logged" };
}

export async function sendAccountEmail(
  message: MailMessage,
): Promise<{ ok: true; mode: "sent" | "logged" } | { ok: false; error: string }> {
  const sent = await sendMail(message, { logName: "last-password-reset.txt" });
  if (sent.ok) return sent;
  if (sent.error === "That email address cannot be used.") return sent;
  if (sent.error === "Email is not set up, so nothing was sent.") {
    return { ok: false, error: "Reset email is not set up, so no link was sent." };
  }
  return { ok: false, error: `The reset email could not be sent. ${sent.error}` };
}
