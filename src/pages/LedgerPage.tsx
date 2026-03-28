import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClient, getTransactionsByClient, addTransaction as dbAddTransaction, updateTransaction, deleteTransaction as dbDeleteTransaction, updateClient, type Client, type Transaction } from '@/lib/db';
import AppHeader from '@/components/AppHeader';
import PaymentReminderCard from '@/components/PaymentReminderCard';
import LedgerPDFExport from '@/components/LedgerPDFExport';
import ClientNotesSheet from '@/components/ClientNotesSheet';
import ClientRating from '@/components/ClientRating';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, MessageCircle, Share2, Plus, AlertTriangle, Pencil, Trash2, FileText, X, StickyNote, HelpCircle, MoreVertical, Search, Printer, FileSpreadsheet, MessageSquare, Lock, ArrowRightLeft, Bell, ShieldAlert, ListFilter, Camera, Palette } from 'lucide-react';
import { toast } from 'sonner';

const LedgerPage = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<(Transaction & { balance: number })[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  
  // States for Edit
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<'debit' | 'credit'>('debit'); 
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false); 
  
  // New States for Long Press & Modals
  const [longPressedTx, setLongPressedTx] = useState<(Transaction & { balance: number }) | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const [showCloseBalanceModal, setShowCloseBalanceModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const colors = [
    { name: 'بدون لون', value: '' },
    { name: 'أحمر', value: 'bg-red-100 dark:bg-red-900/30' },
    { name: 'أخضر', value: 'bg-green-100 dark:bg-green-900/30' },
    { name: 'أزرق', value: 'bg-blue-100 dark:bg-blue-900/30' },
    { name: 'أصفر', value: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { name: 'بنفسجي', value: 'bg-purple-100 dark:bg-purple-900/30' },
  ];

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const c = await getClient(Number(clientId));
    if (c) {
      setClient(c);
      setNewLimit(c.budgetLimit?.toString() || '0');
    }

    const txns = await getTransactionsByClient(Number(clientId));
    let balance = 0, dTotal = 0, cTotal = 0;
    
    const withBalance = txns.map(t => {
      const safeAmount = Number(t.amount) || 0;
      const safeDetails = t.details || '';
      const safeDate = t.date || '';
      const safeType = t.type === 'credit' ? 'credit' : 'debit';
      const safeColor = t.color || '';

      if (safeType === 'debit') { balance += safeAmount; dTotal += safeAmount; }
      else { balance -= safeAmount; cTotal += safeAmount; }
      
      return { ...t, amount: safeAmount, details: safeDetails, date: safeDate, type: safeType, color: safeColor, balance };
    });
    
    setTransactions(withBalance.reverse());
    setTotalDebit(dTotal);
    setTotalCredit(cTotal);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  const netBalance = totalDebit - totalCredit;
  const budgetLimit = client?.budgetLimit || 0;
  const remaining = budgetLimit - totalDebit + totalCredit;
  const consumed = budgetLimit > 0 ? Math.min(((totalDebit - totalCredit) / budgetLimit) * 100, 100) : 0;
  const isOverBudget = budgetLimit > 0 && remaining < 0;

  const filteredTransactions = searchQuery
    ? transactions.filter(tx => 
        (tx.details || '').includes(searchQuery) || 
        (tx.amount || 0).toString().includes(searchQuery) || 
        (tx.date || '').includes(searchQuery)
      )
    : transactions;

  const handleTouchStart = (tx: Transaction & { balance: number }) => {
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      setLongPressedTx(tx);
    }, 500); 
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const handleWhatsApp = () => { 
    triggerHaptic();
    if (client?.phone) window.open(`https://wa.me/${client.phone}`, '_blank'); 
  };
  
  const handleCall = () => { 
    triggerHaptic();
    if (client?.phone) window.open(`tel:${client.phone}`); 
  };

  const handleSMS = () => {
    triggerHaptic();
    const msg = `عزيزي العميل ${client?.name || ''}، رصيدك الحالي هو: ${Math.abs(netBalance).toLocaleString()} ${netBalance >= 0 ? 'عليك' : 'لك'}.`;
    window.open(`sms:${client?.phone}?body=${encodeURIComponent(msg)}`, '_blank');
    setShowMenu(false);
  };

  const handleExportExcel = () => {
    let csv = 'التاريخ,المبلغ,التفاصيل,الرصيد\n';
    transactions.forEach(tx => {
      csv += `${tx.date},${tx.amount},${tx.details},${tx.balance}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `كشف_حساب_${client?.name || 'عميل'}.csv`;
    link.click();
    toast.success('تم تحميل ملف الإكسل');
    setShowMenu(false);
  };

  const handleThermalPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let html = `<html dir="rtl"><head><title>طباعة إيصال</title><style>
      body { font-family: sans-serif; width: 80mm; margin: 0 auto; padding: 10px; font-size: 14px; color: #000; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border-bottom: 1px dashed #000; padding: 6px 0; text-align: center; font-size: 12px; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
      h2 { margin: 0 0 5px 0; font-size: 18px; }
      p { margin: 3px 0; }
    </style></head><body>`;
    html += `<div class="header"><h2>كشف حساب</h2><p>العميل: ${client?.name || 'غير محدد'}</p><p>الرصيد: ${Math.abs(netBalance).toLocaleString()} ${netBalance >= 0 ? 'عليه' : 'له'}</p></div>`;
    html += `<table><tr><th>التاريخ</th><th>المبلغ</th><th>البيان</th><th>الرصيد</th></tr>`;
    transactions.forEach(tx => {
      html += `<tr><td>${tx.date}</td><td>${tx.amount}</td><td>${tx.details}</td><td>${tx.balance}</td></tr>`;
    });
    html += `</table><p style="text-align:center; margin-top:20px; font-size:12px;">نظام إدارة الحسابات</p></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    setShowMenu(false);
  };

  const handleSaveLimit = async () => {
    if (!client?.id) return;
    await updateClient(client.id, { budgetLimit: Number(newLimit) });
    setShowLimitModal(false);
    loadData();
    toast.success('تم تحديث سقف الحساب بنجاح');
  };

  const handleCloseBalance = async () => {
    if (!client?.id || netBalance === 0) {
      toast.info('الرصيد مصفر بالفعل');
      setShowCloseBalanceModal(false);
      return;
    }
    const amountToZero = Math.abs(netBalance);
    const type = netBalance >= 0 ? 'credit' : 'debit'; 
    await dbAddTransaction({ 
      clientId: client.id, 
      amount: amountToZero, 
      type, 
      date: new Date().toISOString().split('T')[0], 
      details: 'إغلاق وتصفية الحساب' 
    });
    setShowCloseBalanceModal(false);
    loadData();
    toast.success('تم تصفية الرصيد بنجاح ✓');
  };

  const startEditTx = (tx: Transaction & { balance: number }) => {
    setEditingTx(tx);
    setEditAmount((tx.amount || 0).toString());
    setEditDetails(tx.details || '');
    setEditDate(tx.date || '');
    setEditType(tx.type);
  };

  const saveEditTx = async () => {
    if (!editingTx?.id) return;
    await updateTransaction(editingTx.id, {
      amount: parseFloat(editAmount) || 0,
      details: editDetails.trim(),
      date: editDate,
      type: editType,
    });
    setEditingTx(null);
    toast.success('تم تعديل المعاملة ✓');
    loadData();
  };

  const confirmDeleteTx = async () => {
    if (showDeleteConfirm === null) return;
    await dbDeleteTransaction(showDeleteConfirm);
    setShowDeleteConfirm(null);
    toast.success('تم حذف المعاملة');
    loadData();
  };

  const handleSetColor = async (color: string) => {
    if (!longPressedTx?.id) return;
    await updateTransaction(longPressedTx.id, { color });
    setLongPressedTx(null);
    setShowColorPicker(false);
    toast.success('تم تلوين المعاملة ✓');
    loadData();
  };

  const handleRatingChange = async (rating: 'excellent' | 'average' | 'poor') => {
    if (!client?.id) return;
    await updateClient(client.id, { rating });
    setClient(prev => prev ? { ...prev, rating } : prev);
    toast.success('تم تحديث التقييم ✓');
  };

  const handleAddNote = async (note: string) => {
    if (!client?.id) return;
    const updatedNotes = [...(client.notes || []), note];
    await updateClient(client.id, { notes: updatedNotes });
    setClient(prev => prev ? { ...prev, notes: updatedNotes } : prev);
  };

  const handleDeleteNote = async (index: number) => {
    if (!client?.id) return;
    const updatedNotes = [...(client.notes || [])];
    updatedNotes.splice(index, 1);
    await updateClient(client.id, { notes: updatedNotes });
    setClient(prev => prev ? { ...prev, notes: updatedNotes } : prev);
  };

  const handleShareImage = async () => {
    triggerHaptic();
    toast.info('جاري تجهيز الصورة بجودة عالية...');
    
    const loadHtml2Canvas = () => {
      return new Promise((resolve, reject) => {
        if ((window as any).html2canvas) {
          resolve((window as any).html2canvas);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => resolve((window as any).html2canvas);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    try {
      const html2canvasLib = await loadHtml2Canvas() as any;
      const element = document.getElementById('ledger-content-to-capture'); 
      if (!element) return;

      // تحسينات لالتقاط الصورة بشكل أفضل
      const canvas = await html2canvasLib(element, { 
        scale: 3, // زيادة الدقة
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => {
          const el = clonedDoc.getElementById('ledger-content-to-capture');
          if (el) el.style.padding = '20px';
        }
      });
      
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) return;
        const fileName = `كشف_حساب_${client?.name || 'عميل'}_${new Date().getTime()}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `كشف حساب - ${client?.name}`,
              text: `مرفق كشف حساب العميل: ${client?.name}\nالرصيد: ${Math.abs(netBalance).toLocaleString()} ${netBalance >= 0 ? 'عليه' : 'له'}`,
            });
          } catch (shareErr) {
            // Fallback to download if share is cancelled or fails
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
          }
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          toast.success('تم تحميل الصورة بنجاح');
        }
        setShowShareModal(false);
      }, 'image/png', 1.0);
    } catch (err) {
      toast.error('حدث خطأ أثناء معالجة الصورة');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-background text-foreground">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <AppHeader 
        title={client?.name || 'دفتر الحسابات'} 
        showBack 
        rightElement={
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-40 py-1 animate-scale-in">
                    <button onClick={handleThermalPrint} className="w-full px-4 py-2.5 text-right flex items-center justify-between hover:bg-muted text-foreground transition-colors">
                      <span className="font-semibold">طباعة حرارية</span>
                      <Printer className="w-4 h-4 text-primary" />
                    </button>
                    <button onClick={() => { setShowLimitModal(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-right flex items-center justify-between hover:bg-muted text-foreground transition-colors">
                      <span className="font-semibold">تعديل سقف الحساب</span>
                      <ShieldAlert className="w-4 h-4 text-primary" />
                    </button>
                    <button onClick={() => { setShowCloseBalanceModal(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-right flex items-center justify-between hover:bg-muted text-foreground transition-colors">
                      <span className="font-semibold">تصفية وإغلاق الحساب</span>
                      <Lock className="w-4 h-4 text-primary" />
                    </button>
                    <button onClick={handleExportExcel} className="w-full px-4 py-2.5 text-right flex items-center justify-between hover:bg-muted text-foreground transition-colors border-t border-border mt-1">
                      <span className="font-semibold">تصدير إكسل</span>
                      <FileSpreadsheet className="w-4 h-4 text-green-500" />
                    </button>
                    <button onClick={() => { setShowHelp(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-right flex items-center justify-between hover:bg-muted text-foreground transition-colors border-t border-border mt-1">
                      <span className="font-semibold">مساعدة</span>
                      <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      <div id="ledger-content-to-capture" className="p-4 space-y-4">
        {showSearch && (
          <div className="relative animate-fade-in">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              autoFocus
              className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="ابحث في التفاصيل أو المبلغ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-[hsl(var(--debit-color))]" />
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">إجمالي عليه</p>
              <p className="text-lg font-black text-[hsl(var(--debit-color))]">{totalDebit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-[hsl(var(--credit-color))]" />
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">إجمالي له</p>
              <p className="text-lg font-black text-[hsl(var(--credit-color))]">{totalCredit.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-0 shadow-md overflow-hidden">
          <div className={`h-1.5 ${netBalance >= 0 ? 'bg-[hsl(var(--debit-color))]' : 'bg-[hsl(var(--credit-color))]'}`} />
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground">الرصيد النهائي</p>
              <p className={`text-2xl font-black ${netBalance >= 0 ? 'text-[hsl(var(--debit-color))]' : 'text-[hsl(var(--credit-color))]'}`}>
                {Math.abs(netBalance).toLocaleString()} 
                <span className="text-xs mr-1">{netBalance >= 0 ? 'عليه' : 'له'}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCall} className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm">
                <Phone className="w-5 h-5" />
              </button>
              <button onClick={handleWhatsApp} className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-all shadow-sm">
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>
          </CardContent>
        </Card>

        {budgetLimit > 0 && (
          <Card className="bg-card border-0 shadow-sm overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`w-4 h-4 ${isOverBudget ? 'text-destructive' : 'text-primary'}`} />
                  <span className="text-xs font-bold text-muted-foreground">سقف الحساب: {budgetLimit.toLocaleString()}</span>
                </div>
                <span className={`text-xs font-black ${remaining >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                  {remaining >= 0 ? `متبقي: ${remaining.toLocaleString()}` : `تجاوز بـ: ${Math.abs(remaining).toLocaleString()}`}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-destructive' : 'bg-primary'}`} 
                  style={{ width: `${consumed}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between pt-2">
          <h3 className="font-black text-foreground flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" /> سجل المعاملات
          </h3>
          <button onClick={() => setShowNotes(true)} className="text-xs font-bold text-primary flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
            <StickyNote className="w-3.5 h-3.5" /> الملاحظات ({client?.notes?.length || 0})
          </button>
        </div>

        <div className="space-y-3 relative">
          <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-muted/30 -z-10" />
          
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border">
              <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">لا توجد معاملات مسجلة</p>
            </div>
          ) : (
            filteredTransactions.map((tx, idx) => (
              <div 
                key={tx.id || idx} 
                className={`relative pr-10 animate-fade-in ${tx.color || ''} rounded-xl transition-colors duration-300`}
                style={{ animationDelay: `${idx * 50}ms` }}
                onTouchStart={() => handleTouchStart(tx)}
                onTouchEnd={handleTouchEnd}
                onContextMenu={(e) => { e.preventDefault(); setLongPressedTx(tx); }}
              >
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background z-10 ${tx.type === 'debit' ? 'bg-[hsl(var(--debit-color))]' : 'bg-[hsl(var(--credit-color))]'}`} />
                
                <Card className="bg-card border-0 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] transition-transform overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-1">
                      <p className={`text-lg font-black ${tx.type === 'debit' ? 'text-[hsl(var(--debit-color))]' : 'text-[hsl(var(--credit-color))]'}`}>
                        {tx.amount.toLocaleString()}
                        <span className="text-[10px] mr-1 font-bold opacity-70">{tx.type === 'debit' ? 'عليه' : 'له'}</span>
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{tx.date}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-sm font-semibold text-foreground/80 line-clamp-1 flex-1 ml-4">{tx.details}</p>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">الرصيد</p>
                        <p className="text-xs font-black text-foreground">{tx.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))
          )}
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-bottom-bar text-bottom-bar z-20 shadow-[0_-2px_15px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-3 py-3">
          <button onClick={() => navigate(`/add-transaction?clientId=${clientId}`)} className="flex items-center gap-1.5 bg-[#FFD54F]/20 hover:bg-[#FFD54F]/30 text-[#FFD54F] px-4 py-2 rounded-lg transition-colors border border-[#FFD54F]/30 shadow-sm">
            <span className="text-sm font-bold">إضافة مبلغ</span>
            <Plus className="w-4 h-4" />
          </button>
          
          <div className="text-center text-sm font-bold bg-white/5 px-3 py-2 rounded-lg">
            {netBalance >= 0 ? 'عليه' : 'له'}: {Math.abs(netBalance).toLocaleString()}
          </div>
          
          <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors">
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-bold">مشاركة</span>
          </button>
        </div>
      </footer>

      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowShareModal(false)}>
          <div className="bg-white w-64 rounded-lg shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col">
              <button onClick={() => { window.print(); setShowShareModal(false); }} className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-end gap-4 hover:bg-gray-50 transition-colors">
                <span className="font-bold text-gray-800 text-lg">PDF</span>
                <FileText className="w-6 h-6 text-red-600" />
              </button>
              <button onClick={handleShareImage} className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-end gap-4 hover:bg-gray-50 transition-colors">
                <span className="font-bold text-gray-800 text-lg">صورة</span>
                <Camera className="w-6 h-6 text-gray-600" />
              </button>
              <button onClick={() => { handleSMS(); setShowShareModal(false); }} className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-end gap-4 hover:bg-gray-50 transition-colors">
                <span className="font-bold text-gray-800 text-lg">رسالة نصية</span>
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </button>
              <button onClick={() => { handleExportExcel(); setShowShareModal(false); }} className="px-5 py-3.5 flex items-center justify-end gap-4 hover:bg-gray-50 transition-colors">
                <span className="font-bold text-gray-800 text-lg">إكسل</span>
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
              </button>
            </div>
          </div>
        </div>
      )}

      {longPressedTx && !showColorPicker && (
        <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in" onClick={() => setLongPressedTx(null)}>
          <div className="bg-card w-full rounded-t-2xl p-4 space-y-3 animate-slide-up shadow-2xl border-t border-border" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="w-12 h-1.5 bg-muted mx-auto rounded-full mb-4" />
            <div className="text-center mb-4">
              <p className="font-bold text-lg text-foreground">{(longPressedTx.amount || 0).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{longPressedTx.details}</p>
            </div>
            <button onClick={() => setShowColorPicker(true)} className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted text-foreground font-semibold transition-colors">
              <Palette className="w-5 h-5 text-primary" /> تلوين المعاملة
            </button>
            <button onClick={() => { startEditTx(longPressedTx); setLongPressedTx(null); }} className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted text-foreground font-semibold transition-colors">
              <Pencil className="w-5 h-5 text-blue-500" /> تعديل المعاملة
            </button>
            <button onClick={() => { setShowDeleteConfirm(longPressedTx.id!); setLongPressedTx(null); }} className="w-full flex items-center gap-3 p-4 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold transition-colors">
              <Trash2 className="w-5 h-5" /> حذف المعاملة
            </button>
          </div>
        </div>
      )}

      {showColorPicker && (
        <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in" onClick={() => { setShowColorPicker(false); setLongPressedTx(null); }}>
          <div className="bg-card w-full rounded-t-2xl p-4 space-y-3 animate-slide-up shadow-2xl border-t border-border" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="w-12 h-1.5 bg-muted mx-auto rounded-full mb-4" />
            <h3 className="text-center font-bold text-lg mb-4">اختر لوناً للمعاملة</h3>
            <div className="grid grid-cols-3 gap-3">
              {colors.map((color) => (
                <button 
                  key={color.name}
                  onClick={() => handleSetColor(color.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted transition-colors ${color.value || 'bg-background'}`}
                >
                  <div className={`w-8 h-8 rounded-full border border-border ${color.value || 'bg-background'}`} />
                  <span className="text-xs font-bold">{color.name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowColorPicker(false)} className="w-full mt-4 p-4 rounded-xl bg-muted text-foreground font-bold">إلغاء</button>
          </div>
        </div>
      )}

      {showLimitModal && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowLimitModal(false)}>
          <Card className="shadow-xl w-80 border-0 animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-6 h-6 text-primary" />
                <h2 className="text-lg font-bold text-foreground">تعديل سقف الحساب</h2>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-2 block">السقف المالي الجديد</label>
                <input className="w-full border border-input rounded-lg px-4 py-3 text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} placeholder="أدخل مبلغ السقف..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveLimit} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold">حفظ السقف</button>
                <button onClick={() => setShowLimitModal(false)} className="flex-1 bg-muted text-foreground py-2.5 rounded-lg font-semibold">إلغاء</button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showCloseBalanceModal && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowCloseBalanceModal(false)}>
          <Card className="shadow-xl w-80 border-0 animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">تصفية وإغلاق الرصيد</h2>
              <p className="text-sm text-muted-foreground">سيتم إنشاء معاملة تلقائية بمبلغ <strong className="text-foreground">{Math.abs(netBalance).toLocaleString()}</strong> لتصفية الحساب بالكامل. هل أنت متأكد؟</p>
              <div className="flex gap-2">
                <button onClick={handleCloseBalance} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold">تأكيد التصفية</button>
                <button onClick={() => setShowCloseBalanceModal(false)} className="flex-1 bg-muted text-foreground py-2.5 rounded-lg font-semibold">إلغاء</button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingTx && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setEditingTx(null)}>
          <Card className="shadow-xl w-80 border-0 animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Pencil className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">تعديل المعاملة</h2>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">المبلغ</label>
                <input className="w-full border border-input rounded-lg px-3 py-2.5 text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">التفاصيل</label>
                <input className="w-full border border-input rounded-lg px-3 py-2.5 text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={editDetails} onChange={e => setEditDetails(e.target.value)} />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">التاريخ</label>
                <input className="w-full border border-input rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>

              <div className="flex gap-4 justify-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="editTransactionType" 
                    value="debit" 
                    checked={editType === 'debit'} 
                    onChange={() => setEditType('debit')} 
                    className="w-5 h-5 accent-[hsl(var(--debit-color))]" 
                  />
                  <span className="font-bold text-foreground">عليه</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="editTransactionType" 
                    value="credit" 
                    checked={editType === 'credit'} 
                    onChange={() => setEditType('credit')} 
                    className="w-5 h-5 accent-[hsl(var(--credit-color))]" 
                  />
                  <span className="font-bold text-foreground">له</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={saveEditTx} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold">حفظ</button>
                <button onClick={() => setEditingTx(null)} className="flex-1 bg-muted text-foreground py-2.5 rounded-lg font-semibold">إلغاء</button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowDeleteConfirm(null)}>
          <Card className="shadow-xl w-80 border-0 animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground">تأكيد حذف المعاملة</h2>
              <p className="text-sm text-muted-foreground">سيتم حذف هذه المعاملة نهائياً وتحديث الرصيد. هل أنت متأكد؟</p>
              <div className="flex gap-2">
                <button onClick={confirmDeleteTx} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-lg font-semibold">حذف</button>
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 bg-muted text-foreground py-2.5 rounded-lg font-semibold">إلغاء</button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ClientNotesSheet
        open={showNotes}
        onClose={() => setShowNotes(false)}
        notes={client?.notes || []}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
      />

      {showHelp && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowHelp(false)}>
          <Card className="shadow-xl w-80 border-0 animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <CardContent className="p-6 text-center space-y-4">
              <HelpCircle className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-lg font-bold text-foreground">كيفية الاستخدام</h2>
              <p className="text-sm text-muted-foreground leading-relaxed text-right">
                - اضغط بشكل مطول على أي معاملة لتلوينها، تعديلها أو حذفها.<br/>
                - استخدم الثلاث نقاط بالأعلى لخيارات الطباعة وإغلاق الرصيد وتصدير الإكسل.
              </p>
              <button onClick={() => setShowHelp(false)} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold">فهمت</button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LedgerPage;
