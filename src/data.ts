import { Product } from './types';

export const mockProducts: Product[] = [];

export const formatCurrency = (amount: number, currency: 'IQD' | 'USD' = 'IQD') => {
  if (currency === 'USD') {
    return '$' + new Intl.NumberFormat('en-US').format(amount);
  }
  return new Intl.NumberFormat('en-US').format(amount) + ' د.ع';
};

export const categories = [];
export const companies = [];

