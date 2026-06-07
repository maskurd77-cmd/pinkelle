import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatCurrency } from "../data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Save,
} from "lucide-react";

export default function Dashboard() {
  const [receipts, setReceipts] = useState<any[]>([]);
    
  useEffect(() => {
    const unsubReceipts = onSnapshot(collection(db, "receipts"), (snap) => {
      setReceipts(snap.docs.map((d) => d.data()));
    });
    const unsubSettings = onSnapshot(
      doc(db, "system", "settings"),
      (docSnap) => {
        
      },
    );
    return () => {
      unsubReceipts();
      
    };
  }, []);

  
  const todayStats = useMemo(() => {
    const todayStr = new Date().toDateString();

    let sales = 0;
    let profit = 0;
    let count = 0;
    let itemsSold = 0;

    receipts.forEach((r) => {
      const ts = r.timestamp?.toDate
        ? r.timestamp.toDate()
        : new Date(r.timestamp);
      if (ts.toDateString() === todayStr) {
        count++;
        const amountUSD = r.totalAmount || 0;
        sales += amountUSD;

        let rProfit = 0;
        let rItems = 0;
        if (r.items && Array.isArray(r.items)) {
          r.items.forEach((item: any) => {
            const cost = item.unitCost || 0;
            const price = item.unitPrice || 0;
            const qty = item.quantity || 1;

            const costUSD = cost;
            const priceUSD = price;

            rProfit += (priceUSD - costUSD) * qty;
            rItems += qty;
          });
        }
        
        const invoiceDiscount = r.discountAmount || 0;
        profit += (rProfit - invoiceDiscount);
        itemsSold += rItems;
      }
    });

    return { sales, profit, count, itemsSold };
  }, [receipts]);

  const { monthlyStats, chartData } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    let thisMonthSales = 0;
    let lastMonthSales = 0;
    let last7DaysSales = 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(now.getDate() - 6); // 7 days including today

    const monthlyTotals: Record<string, number> = {};

    const cData: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      // basic local date for X axis
      const dateStr = d.toLocaleDateString("ku");
      // short month/day
      const shortDate = `${d.getMonth() + 1}/${d.getDate()}`;
      cData.push({ name: shortDate, sales: 0, dateKey: d.toDateString() });
    }

    receipts.forEach((r) => {
      const ts = r.timestamp?.toDate
        ? r.timestamp.toDate()
        : new Date(r.timestamp);
      const m = ts.getMonth();
      const y = ts.getFullYear();

      const amountUSD = r.totalAmount || 0;

      if (m === currentMonth && y === currentYear) {
        thisMonthSales += amountUSD;
      }

      if (m === lastMonth && y === lastMonthYear) {
        lastMonthSales += amountUSD;
      }

      if (ts >= sevenDaysAgo && ts <= now) {
        last7DaysSales += amountUSD;
      }

      const dStr = ts.toDateString();
      const match = cData.find((item) => item.dateKey === dStr);
      if (match) {
        match.sales += amountUSD;
      }

      const monthKey = `${y}-${(m + 1).toString().padStart(2, "0")}`;
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = 0;
      }
      monthlyTotals[monthKey] += amountUSD;
    });

    let bestMonth = "";
    let bestMonthVal = -1;
    let worstMonth = "";
    let worstMonthVal = Infinity;

    Object.entries(monthlyTotals).forEach(([mKey, val]) => {
      if (val > bestMonthVal) {
        bestMonthVal = val;
        bestMonth = mKey;
      }
      if (val < worstMonthVal) {
        worstMonthVal = val;
        worstMonth = mKey;
      }
    });

    if (worstMonthVal === Infinity) {
      worstMonthVal = 0;
    }

    // Format best/worst labels
    const formatMonth = (mKey: string) => {
      if (!mKey) return "دیاری نەکراوە";
      const [y, m] = mKey.split("-");
      return `${m}/${y}`;
    };

    const salesProgress =
      lastMonthSales > 0
        ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100
        : 0;

    return {
      monthlyStats: {
        thisMonthSales,
        lastMonthSales,
        last7DaysSales,
        salesProgress,
        bestMonth: bestMonth ? `${formatMonth(bestMonth)}` : "-",
        bestMonthVal,
        worstMonth: worstMonth ? `${formatMonth(worstMonth)}` : "-",
        worstMonthVal,
      },
      chartData: cData,
    };
  }, [receipts]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-sm p-3 border border-slate-100 rounded-xl shadow-xl text-right">
          <p className="text-slate-500 text-xs mb-1 font-medium">{label}</p>
          <p className="font-bold text-pink-600 font-mono text-lg">
            {formatCurrency(payload[0].value, "USD")}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 flex-1 overflow-auto custom-scrollbar lg:pr-2">
      {/* Today's Overview */}
      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        <Activity className="text-pink-600" size={20} />
        پوختەی ئەمڕۆ
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-5 rounded-3xl shadow-lg text-white relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="text-pink-100 text-sm font-medium mb-1">
                فرۆشتنی ئەمڕۆ
              </h3>
              <p className="text-3xl font-bold font-mono tracking-tight">
                {formatCurrency(todayStats.sales, "USD")}
              </p>
            </div>
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <DollarSign size={24} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-500 text-sm font-medium mb-1">
                قازانجی ئەمڕۆ
              </h3>
              <p className="text-2xl font-bold font-mono text-green-600">
                {formatCurrency(todayStats.profit, "USD")}
              </p>
            </div>
            <div className="p-2 bg-green-50 rounded-xl">
              <TrendingUp size={24} className="text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-500 text-sm font-medium mb-1">
                وەسڵەکانی ئەمڕۆ
              </h3>
              <p className="text-2xl font-bold font-mono text-slate-800">
                {todayStats.count}
              </p>
            </div>
            <div className="p-2 bg-pink-50 rounded-xl">
              <Receipt size={24} className="text-pink-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-500 text-sm font-medium mb-1">
                کالاکانی فرۆشراو
              </h3>
              <p className="text-2xl font-bold font-mono text-slate-800">
                {todayStats.itemsSold}
              </p>
            </div>
            <div className="p-2 bg-purple-50 rounded-xl">
              <ShoppingBag size={24} className="text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Monthly Highlights */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">
            سەرژمێری مانگانە
          </h2>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4 text-slate-600">
              <span className="font-medium text-sm">ئەم مانگە</span>
              {monthlyStats.salesProgress !== 0 && (
                <div
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${monthlyStats.salesProgress > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                >
                  {monthlyStats.salesProgress > 0 ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  <span dir="ltr">
                    {Math.abs(monthlyStats.salesProgress).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <p className="text-3xl font-bold font-mono text-slate-800 mb-6">
              {formatCurrency(monthlyStats.thisMonthSales, "USD")}
            </p>

            <div className="space-y-4 mt-6 border-t border-slate-50 pt-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 font-medium">
                  مانگی پێشوو
                </span>
                <span className="font-mono font-bold text-slate-700">
                  {formatCurrency(monthlyStats.lastMonthSales, "USD")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 font-medium">
                  باشترین مانگ{" "}
                  <span
                    className="text-xs bg-slate-100 px-1 ml-1 rounded text-slate-400 py-0.5"
                    dir="ltr"
                  >
                    {monthlyStats.bestMonth}
                  </span>
                </span>
                <span className="font-mono font-bold text-green-600">
                  {formatCurrency(monthlyStats.bestMonthVal, "USD")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 font-medium">
                  خراپترین مانگ{" "}
                  <span
                    className="text-xs bg-slate-100 px-1 ml-1 rounded text-slate-400 py-0.5"
                    dir="ltr"
                  >
                    {monthlyStats.worstMonth}
                  </span>
                </span>
                <span className="font-mono font-bold text-red-500">
                  {formatCurrency(monthlyStats.worstMonthVal, "USD")}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl shadow-lg text-white">
            <h3 className="text-slate-400 text-sm font-medium mb-1">
              فرۆشتنی ٧ ڕۆژی ڕابردوو
            </h3>
            <p className="text-2xl font-bold font-mono text-white">
              {formatCurrency(monthlyStats.last7DaysSales, "USD")}
            </p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">
            ڕێژەی فرۆشتن لە ٧ ڕۆژی ڕابردوو
          </h2>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[380px] flex flex-col justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#94a3b8",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                  tickFormatter={(val) =>
                    val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
                  }
                  dx={-10}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "#f1f5f9", strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#ec4899"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#ec4899" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
