export interface Product {
  id: string;
  name: string;
  category: string;
  company: string;
  unitCost: number;     // تێچووی دانە
  unitPrice: number;    // نرخی دانە
  packSize: number;     // قەبارەی تەک
  stock: number;        // ستۆک
  barcode: string;      // بارکۆد
  imageUrl?: string;    // وێنەی کاڵا
}
