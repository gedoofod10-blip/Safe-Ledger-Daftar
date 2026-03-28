import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllClients, getAllTransactions, type Client, type Transaction } from '@/lib/db';
import { Search, FileText, ArrowLeft, Menu, Plus } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const ReportsPage = () => {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null); 
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const allClients = await getAllClients();
      const allTx = await getAllTransactions();
      const processed = allClients.map(client => {
        const clientTxns = allTx.filter(tx => tx.clientId === client.id);
        let bal = 0;
        let lastDate = client.createdAt;
        clientTxns.forEach(tx => {
          if (tx.type === 'debit') bal += tx.amount;
          else bal -= tx.amount;
          lastDate = tx.date;
        });
        const days = differenceInDays(new Date(), parseISO(lastDate));
        return { id: client.id, name: client.name, balance: bal, days: Math.max(0, days) };
      }).filter(row => row.balance !== 0);
      setReportData(processed);
      setLoading(false);
    }
    fetchData();
  }, []);

  const totalBalance = reportData.reduce((sum, row) => sum + row.balance, 0);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    const loadingToast = toast.loading('جاري تجهيز ملف PDF المحترم...');
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`تقرير_اجمالي_المبالغ_${new Date().getTime()}.pdf`);
      toast.dismiss(loadingToast);
      toast.success('تم تصدير الملف بنجاح ✓');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('فشل في تصدير الملف');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans" dir="rtl">
      <div ref={reportRef} className="bg-white flex-1 flex flex-col">
        {/* الشريط العلوي - بني */}
        <div className="bg-[#5D4037] text-white flex items-center justify-between p-3 shadow-md">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6" /></button>
            <h1 className="text-lg font-bold">إجمالي المبالغ#عام</h1>
          </div>
          <div className="flex items-center gap-5">
            <Search className="w-5 h-5 opacity-80" />
            <button onClick={handleExportPDF} className="relative p-1 rounded-md"><FileText className="w-6 h-6 text-white" /><div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border border-white" /></button>
          </div>
        </div>

        {/* رأس الجدول */}
        <div className="bg-gray-100 border-b border-gray-300 flex text-center py-2 px-1 text-[13px] font-bold text-gray-600">
          <div className="w-10"></div>
          <div className="flex-[2] text-right pr-4">الإسم</div>
          <div className="flex-1 border-r border-gray-300">المبلغ</div>
          <div className="flex-1 border-r border-gray-300">عدد_الأيام</div>
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (<div className="p-10 text-center text-gray-400 font-bold">جاري التحميل...</div>) : (
            reportData.map((row) => (
              <div key={row.id} className="flex items-center border-b border-gray-200 py-3 px-1 active:bg-gray-50">
                <div className="w-10 flex justify-center opacity-30"><div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-gray-600 rotate-180" /></div>
                <div className="flex-[2] text-right pr-4 font-bold text-gray-800">{row.name}</div>
                <div className="flex-1 text-center font-bold text-gray-700">{row.balance.toLocaleString()}</div>
                <div className="flex-1 text-center font-bold text-gray-500">{row.days}</div>
              </div>
            ))
          )}
        </div>

        {/* الشريط السفلي - بني غامق */}
        <div className="bg-[#4E342E] text-white p-4 flex justify-center items-center shadow-lg border-t border-white/10">
          <div className="text-xl font-bold">
            {totalBalance >= 0 ? `عليه ${totalBalance.toLocaleString()} محلي` : `له ${Math.abs(totalBalance).toLocaleString()} محلي`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
