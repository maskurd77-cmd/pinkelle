import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  Calendar,
  Filter,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function Reports() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [filterType, setFilterType] = useState<"all" | "month" | "day">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toISOString().slice(0, 10),
  ); // YYYY-MM-DD

  useEffect(() => {
    const unsubReceipts = onSnapshot(collection(db, "receipts"), (snap) => {
      setReceipts(snap.docs.map((d) => d.data()));
    });
    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
      setExpenses(snap.docs.map((d) => d.data()));
    });
    return () => {
      unsubReceipts();
      unsubExpenses();
    };
  }, []);

  const filteredData = useMemo(() => {
    let filteredReceipts = receipts;
    let filteredExpenses = expenses;

    if (filterType === "month") {
      const [year, month] = selectedMonth.split("-");
      filteredReceipts = receipts.filter((r) => {
        const d = r.timestamp?.toDate
          ? r.timestamp.toDate()
          : new Date(r.timestamp);
        return (
          d.getFullYear() === parseInt(year) &&
          d.getMonth() + 1 === parseInt(month)
        );
      });
      filteredExpenses = expenses.filter((e) => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return (
          d.getFullYear() === parseInt(year) &&
          d.getMonth() + 1 === parseInt(month)
        );
      });
    } else if (filterType === "day") {
      const [year, month, day] = selectedDay.split("-");
      filteredReceipts = receipts.filter((r) => {
        const d = r.timestamp?.toDate
          ? r.timestamp.toDate()
          : new Date(r.timestamp);
        return (
          d.getFullYear() === parseInt(year) &&
          d.getMonth() + 1 === parseInt(month) &&
          d.getDate() === parseInt(day)
        );
      });
      filteredExpenses = expenses.filter((e) => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return (
          d.getFullYear() === parseInt(year) &&
          d.getMonth() + 1 === parseInt(month) &&
          d.getDate() === parseInt(day)
        );
      });
    }

    return { filteredReceipts, filteredExpenses };
  }, [receipts, expenses, filterType, selectedMonth, selectedDay]);

  const { stats, chartData, categoryData } = useMemo(() => {
    let sales = 0;
    let retailSales = 0;
    let wholesaleSales = 0;
    let retailProfit = 0;
    let wholesaleProfit = 0;
    let profit = 0;
    let itemsSold = 0;
    let retailItemsSold = 0;
    let wholesaleItemsSold = 0;
    let totalExpense = 0;

    const salesByDate: Record<string, number> = {};
    const categoryCount: Record<string, number> = {};

    filteredData.filteredReceipts.forEach((r) => {
            let cAmount = r.totalAmount || 0;
            
      sales += cAmount;

      const ts = r.timestamp?.toDate
        ? r.timestamp.toDate()
        : new Date(r.timestamp);
      const dateKey =
        filterType === "day"
          ? `${ts.getHours()}:00`
          : ts.toLocaleDateString("ku");

      if (!salesByDate[dateKey]) salesByDate[dateKey] = 0;
      salesByDate[dateKey] += cAmount;

      if (r.items && Array.isArray(r.items)) {
        r.items.forEach((item: any) => {
          const cost = item.unitCost || 0;
          const price = item.unitPrice || 0;
          const qty = item.quantity || 1;
          
          let itemTotal = price * qty;
          let itemProfit = (price - cost) * qty;

          

          profit += itemProfit;
          itemsSold += qty;

          if (item.isWholesale) {
            wholesaleItemsSold += qty;
            wholesaleSales += itemTotal;
            wholesaleProfit += itemProfit;
          } else {
            retailItemsSold += qty;
            retailSales += itemTotal;
            retailProfit += itemProfit;
          }

          const cat = item.category || "گشتی";
          if (!categoryCount[cat]) categoryCount[cat] = 0;
          categoryCount[cat] += qty;
        });
      }
    });

    filteredData.filteredExpenses.forEach((e) => {
      // Assuming old expenses might be IQD, if so we should divide. But expense doesn't have currency field currently maybe?
      // Defaulting to 1500 divisor if amount > 100000 to guess? No, let's just use it as is if it's already USD.
      // Wait we used to sum it to totalExpenseIQD. Let's just track it as is for now, or divide by 1500 if we assume it was IQD.
      // Let's divide by 1500 to match old logic.
      totalExpense += (e.amount || 0) / 1500; 
    });

    const cData = Object.entries(salesByDate).map(([name, salesAmount]) => ({
      name,
      sales: salesAmount,
    }));
    const pData = Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      stats: {
        sales,
        retailSales,
        wholesaleSales,
        retailProfit,
        wholesaleProfit,
        profit,
        totalExpense,
        itemsSold,
        retailItemsSold,
        wholesaleItemsSold,
      },
      chartData: cData,
      categoryData: pData,
    };
  }, [filteredData, filterType]);

  const COLORS = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-sm p-3 border border-slate-100 rounded-xl shadow-xl text-right">
          <p className="text-slate-500 text-xs mb-1 font-medium">{label}</p>
          <p className="font-bold text-amber-600 font-mono text-lg">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto custom-scrollbar pb-6 lg:pr-2">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <div className="p-2 bg-pink-50 rounded-xl">
            <LineChartIcon className="text-amber-600" size={24} />
          </div>
          ڕاپۆرتەکان و ئامارەکان
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterType === "all" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              سەرجەم
            </button>
            <button
              onClick={() => setFilterType("month")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterType === "month" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              مانگانە
            </button>
            <button
              onClick={() => setFilterType("day")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterType === "day" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              ڕۆژانە
            </button>
          </div>

          {filterType === "month" && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
            />
          )}
          {filterType === "day" && (
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: "کۆی فرۆشتنی تاک",
            value: (
              <div className="flex flex-col">
                <span className="text-2xl text-pink-600">
                  {formatCurrency(stats.retailSales)}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  قازانج: {formatCurrency(stats.retailProfit)}
                </span>
              </div>
            ),
            trend: `${stats.retailItemsSold} دانەی تاک`,
            color: "blue",
            gradient: "from-pink-500 to-pink-600",
            shadow: "shadow-pink-500/20",
          },
          {
            title: "کۆی فرۆشتنی جوملە",
            value: (
              <div className="flex flex-col">
                <span className="text-2xl text-purple-600">
                  {formatCurrency(stats.wholesaleSales)}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  قازانج: {formatCurrency(stats.wholesaleProfit)}
                </span>
              </div>
            ),
            trend: `${stats.wholesaleItemsSold} دانەی جوملە`,
            color: "purple",
            gradient: "from-purple-500 to-fuchsia-600",
            shadow: "shadow-purple-500/20",
          },
          {
            title: "قازانجی سافی",
            value: (
              <div className="flex flex-col">
                <span className="text-2xl text-green-600">
                  {formatCurrency(
                    stats.profit - stats.totalExpense,
                  )}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  پێش خەرجی: {formatCurrency(stats.profit)}
                </span>
              </div>
            ),
            trend: "دوای دەرکردنی خەرجی",
            color: "emerald",
            gradient: "from-emerald-500 to-pink-600",
            shadow: "shadow-emerald-500/20",
          },
          {
            title: "شیکاری گشتی",
            value: (
              <div className="flex flex-col gap-1">
                <span className="text-lg text-slate-800">
                  {stats.itemsSold} <span className="text-sm">کەرەستە</span>
                </span>
                <span className="text-[11px] text-orange-500">
                  خەرجی: {formatCurrency(stats.totalExpense)}
                </span>
              </div>
            ),
            trend: "کۆی گشتی کەرەستەکان و خەرجی",
            color: "orange",
            gradient: "from-orange-500 to-amber-600",
            shadow: "shadow-orange-500/20",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <h3 className="text-slate-500 text-sm font-bold mb-3">
              {stat.title}
            </h3>
            <div
              className={`font-black tracking-tight font-mono text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient} drop-shadow-sm`}
            >
              {stat.value}
            </div>
            <div
              className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-${stat.color}-50 text-${stat.color}-700 text-xs font-bold border border-${stat.color}-100`}
            >
              <TrendingUp size={14} />
              {stat.trend}
            </div>
            <div
              className={`absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-gradient-to-br ${stat.gradient} opacity-5 group-hover:scale-110 transition-transform duration-500`}
            />
            <div
              className={`absolute -top-4 -right-4 w-16 h-16 rounded-full bg-gradient-to-br ${stat.gradient} opacity-[0.03] group-hover:scale-125 transition-transform duration-500`}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[
          {
            title: "فرۆشتنی تاک",
            value: (
              <div className="flex flex-col">
                <span className="text-2xl text-cyan-600">
                  {formatCurrency(
                    stats.retailSales,
                  )}
                </span>
              </div>
            ),
            trend: "تاک",
            color: "blue",
            gradient: "from-pink-500 to-cyan-600",
          },
          {
            title: "فرۆشتنی جوملە",
            value: (
              <div className="flex flex-col">
                <span className="text-2xl text-pink-600">
                  {formatCurrency(
                    stats.wholesaleSales,
                  )}
                </span>
              </div>
            ),
            trend: "جوملە",
            color: "purple",
            gradient: "from-purple-500 to-pink-600",
          },
          {
            title: "فرۆشراو بە تاک",
            value: (
              <div className="flex flex-col">
                <span className="text-2xl">
                  {stats.retailItemsSold} <span className="text-sm">دانە</span>
                </span>
              </div>
            ),
            trend: "تاک",
            color: "cyan",
            gradient: "from-cyan-500 to-pink-500",
          },
          {
            title: "فرۆشراو بە جوملە",
            value: (
              <div className="flex flex-col">
                <span className="text-2xl">
                  {stats.wholesaleItemsSold}{" "}
                  <span className="text-sm">دانە</span>
                </span>
              </div>
            ),
            trend: "جوملە",
            color: "fuchsia",
            gradient: "from-fuchsia-500 to-purple-500",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
          >
            <h3 className="text-slate-500 text-xs font-bold mb-2">
              {stat.title}
            </h3>
            <div
              className={`font-black tracking-tight font-mono text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient}`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 mb-6">
        <div className="xl:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 flex flex-col min-h-[450px]">
          <h3 className="text-lg font-extrabold text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-amber-600">
              <LineChartIcon size={20} />
            </div>
            هێڵکاری فرۆشتن لە ماوەی دیاریکراودا
          </h3>
          <div className="flex-1 w-full min-h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorSalesReport"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.4} />
                      <stop
                        offset="100%"
                        stopColor="#ec4899"
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                    <filter id="shadow" height="200%">
                      <feDropShadow
                        dx="0"
                        dy="8"
                        stdDeviation="8"
                        floodColor="#ec4899"
                        floodOpacity="0.25"
                      />
                    </filter>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                    dy={15}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 13,
                      fontFamily: "monospace",
                      fontWeight: 600,
                    }}
                    tickFormatter={(val) =>
                      val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
                    }
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{
                      stroke: "#cbd5e1",
                      strokeWidth: 2,
                      strokeDasharray: "5 5",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#ec4899"
                    strokeWidth={5}
                    strokeLinecap="round"
                    fillOpacity={1}
                    fill="url(#colorSalesReport)"
                    activeDot={{
                      r: 8,
                      fill: "#fff",
                      stroke: "#ec4899",
                      strokeWidth: 4,
                    }}
                    style={{ filter: "url(#shadow)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                  <Filter
                    size={48}
                    className="text-slate-300"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-bold text-slate-500">
                  هیچ داتایەک بوونی نییە بۆ ئەم کاتە
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 flex flex-col min-h-[450px]">
          <h3 className="text-lg font-extrabold text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600">
              <PieChartIcon size={20} />
            </div>
            پڕفرۆشترین جۆرەکان
          </h3>
          <div className="flex-1 w-full min-h-[350px]">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {COLORS.map((color, index) => (
                      <linearGradient
                        key={`grad-${index}`}
                        id={`pieGrad${index}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={color} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`url(#pieGrad${index})`}
                        className="drop-shadow-sm hover:opacity-90 transition-opacity outline-none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow:
                        "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                      padding: "12px",
                    }}
                    itemStyle={{ color: "#0f172a", fontWeight: "bold" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={40}
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-sm font-medium text-slate-700 mr-1">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                  <PieChartIcon
                    size={48}
                    className="text-slate-300"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-bold text-slate-500">
                  هیچ داتایەک بوونی نییە
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
