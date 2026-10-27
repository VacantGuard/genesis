export type BusinessProfile = {
  name: string;
  about: string;
};

export type MenuCategory = {
  id: number;
  name: string;
  sortOrder: number;
};

export type MenuItem = {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  sortOrder: number;
};

export type PublicCategory = {
  id: number;
  name: string;
  items: {
    id: number;
    name: string;
    description: string;
    priceCents: number;
    available: boolean;
  }[];
};

export type Company = {
  id: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
};

export type Customer = {
  id: number;
  clientNumber: string;
  name: string;
  phone: string;
  email: string;
  companyId: number | null;
  companyName: string;
  notes: string;
  deliveryLine1: string;
  deliveryLine2: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostalCode: string;
  deliveryAddress: string;
  deliveryLocateUrl: string;
};

export type OrderItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  note: string;
};

export type KitchenOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  email: string;
  companyName: string;
  notes: string;
  cardLast4: string;
  totalCents: number;
  createdAt: string;
  deliveryLine1: string;
  deliveryLine2: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostalCode: string;
  deliveryAddress: string;
  deliveryLocateUrl: string;
  items: OrderItem[];
};

export type SmsDelivery = {
  id: number;
  recipientName: string;
  recipientKind: "customer" | "company_contact";
  phone: string;
  body: string;
  status: string;
  detail: string;
  createdAt: string;
};

export type Campaign = {
  id: number;
  message: string;
  linkUrl: string;
  includeCustomers: boolean;
  includeCompanyContacts: boolean;
  recipientCount: number;
  createdAt: string;
  deliveries: SmsDelivery[];
};

export type DashboardStats = {
  orderCount: number;
  todayOrderCount: number;
  salesCents: number;
  customerCount: number;
  companyCount: number;
  availableItemCount: number;
  campaignCount: number;
};
