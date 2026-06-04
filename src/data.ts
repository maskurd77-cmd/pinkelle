import { Product } from './types';

export const mockProducts: Product[] = [];

export const formatCurrency = (amount: number, currency?: string) => {
  return '$' + new Intl.NumberFormat('en-US').format(amount);
};

export const categories = [];
export const companies = [];

