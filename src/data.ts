import { Product } from './types';

export const mockProducts: Product[] = [];

export const formatCurrency = (amount: number, currency?: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
};

export const categories = [];
export const companies = [];

