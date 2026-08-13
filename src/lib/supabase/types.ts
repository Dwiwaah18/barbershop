export type UserRole = 'superadmin' | 'owner' | 'cashier' | 'barber' | 'customer';
export type BookingStatus = 'pending' | 'approved' | 'confirmed' | 'completed' | 'cancelled';
export type BarberStatus = 'free' | 'busy' | 'break';
export type BookingSource = 'online' | 'walkin';
export type PaymentMethod = 'cash' | 'qris' | 'deposit';
export type TransactionStatus = 'paid' | 'void';
export type WalletTxType = 'topup' | 'redeem' | 'refund' | 'adjustment';
export type WalletTxStatus = 'pending' | 'verified' | 'rejected';
export type ShiftStatus = 'open' | 'closed';
export type PettyCashType = 'cash_in' | 'expense';
export type AttendanceStatus = 'clocked_in' | 'clocked_out';
export type CashAdvanceStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type CommissionType = 'percent' | 'fixed' | 'salary' | 'tiered' | 'net_percent';
export type TenantStatus = 'active' | 'suspended';

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  owner_id: string | null;
  status: TenantStatus;
  qris_image_url: string | null;
  created_at: string;
};

export type Branch = {
  id: string;
  tenant_id: string | null;
  name: string;
  address: string | null;
  owner_id: string | null;
  commission_type: CommissionType;
  commission_percent: number;
  created_at: string;
};

export type StaffBranchAssignment = {
  profile_id: string;
  branch_id: string;
};

export type CommissionTier = {
  id: string;
  branch_id: string;
  min_services: number;
  commission_percent: number;
  created_at: string;
};

export type PayrollPayment = {
  id: string;
  profile_id: string;
  branch_id: string;
  period_start: string;
  period_end: string;
  services_count: number;
  gross_commission: number;
  kasbon_deduction: number;
  net_pay: number;
  paid_by: string | null;
  paid_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  branch_id: string | null;
  wallet_balance: number;
  family_id: string | null;
  barber_status: BarberStatus | null;
  monthly_salary: number | null;
  is_working_barber: boolean;
  tenant_id: string | null;
  created_at: string;
};

export type Service = {
  id: string;
  branch_id: string | null;
  name: string;
  price: number;
  duration_minutes: number;
  is_addon: boolean;
  fixed_commission: number | null;
  cost_price: number | null;
  created_at: string;
};

export type Booking = {
  id: string;
  branch_id: string;
  customer_id: string | null;
  customer_name: string | null;
  barber_id: string | null;
  status: BookingStatus;
  source: BookingSource;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_price: number;
  created_at: string;
};

export type BookingItem = {
  id: string;
  booking_id: string;
  service_id: string;
  service_name: string;
  price: number;
};

export type Transaction = {
  id: string;
  branch_id: string;
  booking_id: string | null;
  cashier_id: string;
  customer_id: string | null;
  subtotal: number;
  discount: number;
  deposit_used: number;
  total: number;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  created_at: string;
};

export type TransactionItem = {
  id: string;
  transaction_id: string;
  service_id: string | null;
  name: string;
  price: number;
  quantity: number;
};

export type WalletTransaction = {
  id: string;
  profile_id: string;
  branch_id: string | null;
  type: WalletTxType;
  amount: number;
  status: WalletTxStatus;
  proof_url: string | null;
  verified_by: string | null;
  created_at: string;
};

export type Shift = {
  id: string;
  branch_id: string;
  cashier_id: string;
  opening_cash: number;
  closing_cash: number | null;
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;
};

export type PettyCashEntry = {
  id: string;
  shift_id: string;
  type: PettyCashType;
  amount: number;
  description: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  profile_id: string;
  branch_id: string;
  status: AttendanceStatus;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_photo_url: string | null;
};

export type CashAdvance = {
  id: string;
  profile_id: string;
  branch_id: string;
  amount: number;
  reason: string | null;
  status: CashAdvanceStatus;
  approved_by: string | null;
  created_at: string;
};
