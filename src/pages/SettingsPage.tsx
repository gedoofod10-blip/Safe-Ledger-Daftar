import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllClients, updateClient } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowRight, Plus, Pencil, Trash2, X, Share2, Download } from 'lucide-react';
import { exportBackup, importBackup } from '@/lib/backup';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // إعدادات التطبيق
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    const defaultSettings = {
      shopName: 'الإسم', shopAddress: 'العنوان', shopPhone: 'رقم التلفون',
      printInfo: true, showDate: true, printAsc: true,
      waInsteadSms: false, dailyBackup: true,
      requirePassword: false, appPassword: ''
    };
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  // حالات التصنيفات الديناميكية
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [showEditCatModal, setShowEditCatModal] = useState<{old: string, new: string} | null>(null);
  const [selectedCatAction, setSelectedCatAction] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');

  // مؤقت الضغط المطول
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  // جلب التصنيفات وعدد العملاء من قاعدة البيانات
  const loadCategoriesData = async () => {
    const savedCatsRaw = localStorage.getItem('customCategories');
    let currentCats: string[] = [];
    
    if (savedCatsRaw) {
      currentCats = JSON.parse(savedCatsRaw);
    } else {
      currentCats = ['عام', 'عملاء', 'موردين'];
      localStorage.setItem('customCategories', JSON.stringify(currentCats));
    }

    const clients = await getAllClients();
    const counts: Record<string, number> = {};
    
    clients.forEach(c => {
      const cat = c.category || 'عام';
      counts[cat] = (counts[cat] || 0) + 1;
      
      if (!currentCats.includes(cat) && cat !== 'عام') {
        currentCats.push(cat);
      }
    });

    setCategories(currentCats);
    setCategoryCounts(counts);
  };

  useEffect(() => {
    if (activeModal === 'categories') {
      loadCategoriesData();
    }
  }, [activeModal]);

  const toggle = (key: string) => setSettings({...settings, [key]: !settings[key as keyof typeof settings]});

  // دوال إدارة التصنيفات
  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return toast.error('أدخل اسم التصنيف');
    if (categories.includes(trimmed)) return toast.error('التصنيف موجود مسبقاً');
    
    const newCats = [...categories, trimmed];
    setCategories(newCats);
    localStorage.setItem('customCategories', JSON.stringify(newCats));
    setShowAddCatModal(false);
    setNewCatName('');
    toast.success('تم إضافة التصنيف');
  };

  const handleEditCategory = async () => {
    if (!showEditCatModal) return;
    const trimmed = showEditCatModal.new.trim();
    if (!trimmed) return toast.error('أدخل اسم التصنيف الجديد');
    if (trimmed === showEditCatModal.old) {
      setShowEditCatModal(null);
      setSelectedCatAction(null);
      return;
    }
    if (categories.includes(trimmed)) return toast.error('الاسم الجديد موجود مسبقاً');

    const newCats = categories.map(c => c === showEditCatModal.old ? trimmed : c);
    setCategories(newCats);
    localStorage.setItem('customCategories', JSON.stringify(newCats));

    const clients = await getAllClients();
    const clientsToUpdate = clients.filter(c => c.category === showEditCatModal.old);
    for (const c of clientsToUpdate) {
      if (c.id) await updateClient(c.id, { category: trimmed });
    }

    setShowEditCatModal(null);
    setSelectedCatAction(null);
    loadCategoriesData();
    toast.success('تم تعديل اسم التصنيف ونقل حساباته بنجاح ✓');
  };

  const handleDeleteCategory = async (catName: string) => {
    if (catName === 'عام') return toast.error('لا يمكن حذف التصنيف الأساسي "عام"');

    const confirm = window.confirm(`هل أنت متأكد من حذف تصنيف "${catName}"؟\nسيتم نقل جميع الحسابات الموجودة به إلى تصنيف "عام".`);
    if (!confirm) {
        setSelectedCatAction(null);
        return;
    }

    const clients = await getAllClients();
    const clientsToMove = clients.filter(c => c.category === catName);
    for (const c of clientsToMove) {
      if (c.id) await updateClient(c.id, { category: 'عام' });
    }

    const newCats = categories.filter(c => c !== catName);
    setCategories(newCats);
    localStorage.setItem('customCategories', JSON.stringify(newCats));
    setSelectedCatAction(null);
    loadCategoriesData();
    toast.success('تم حذف التصنيف ونقل حساباته إلى عام ✓');
  };

  const handleLongPressStart = (cat: string) => {
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      setSelectedCatAction(cat);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  // دوال النسخ الاحتياطي
  const handleBackupShare = async () => {
    try {
      await exportBackup(); 
      toast.success('تم تصدير وحفظ النسخة الاحتياطية بنجاح ✓');
    } catch (error) {
      toast.error('فشل في تصدير النسخة الاحتياطية');
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importBackup(file);
      toast.success(`تم استرجاع ${result.clients} عميل و ${result.transactions} معاملة بنجاح ✓`);
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch (error) {
      toast.error('فشل في استرجاع البيانات. تأكد من صحة الملف.');
    }
    e.target.value = '';
  };

  const menuItems = [
    { id: 'personal', title: 'البيانات الشخصية' },
    { id: 'print', title: 'خيارات الطباعة' },
    { id: 'security', title: 'خيارات الأمان' },
    { id: 'categories', title: 'التصنيفات' },
    { id: 'backup', title: 'خيارات حفظ البيانات' },
    { id: 'pc', title: 'استعراض البيانات من الكمبيوتر' },
    { id: 'other', title: 'خيارات أخرى' },
  ];

  return (
    <div className="min-h-screen bg-white pb-16 flex flex-col" dir="rtl">
      <div className="bg-[#5D4037] text-white flex items-center p-4 shadow-md sticky top-0 z-40">
        <button onClick={() => navigate(-1)} className="ml-4"><ArrowRight className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold">إعدادات</h1>
      </div>

      <div className="flex-1 divide-y divide-gray-100">
        {menuItems.map((item) => (
          <div key={item.id} onClick={() => setActiveModal(item.id)} className="p-5 flex items-center gap-4 active:bg-gray-50 cursor-pointer">
            <div className="w-2.5 h-2.5 rounded-full bg-[#5D4037]" />
            <span className="text-lg font-bold text-gray-700">{item.title}</span>
          </div>
        ))}
      </div>

      {activeModal === 'personal' && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="bg-[#5D4037] text-white p-4 flex items-center">
            <button onClick={() => setActiveModal(null)} className="ml-4"><ArrowRight/></button>
            <h2 className="font-bold">البيانات الشخصية</h2>
          </div>
          <div className="p-4 space-y-6 overflow-y-auto">
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-[#5D4037] rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold">$</div>
            </div>
            <div className="space-y-4">
              <div className="border-b pb-2"><label className="text-xs text-gray-400">الإسم</label><input className="w-full font-bold outline-none" value={settings.shopName} onChange={e=>setSettings({...settings, shopName: e.target.value})}/></div>
              <div className="border-b pb-2"><label className="text-xs text-gray-400">العنوان</label><input className="w-full font-bold outline-none" value={settings.shopAddress} onChange={e=>setSettings({...settings, shopAddress: e.target.value})}/></div>
              <div className="border-b pb-2"><label className="text-xs text-gray-400">رقم التلفون</label><input className="w-full font-bold outline-none" value={settings.shopPhone} onChange={e=>setSettings({...settings, shopPhone: e.target.value})}/></div>
            </div>
            <button onClick={() => {toast.success('تم حفظ البيانات بنجاح ✓'); setActiveModal(null);}} className="w-full bg-[#5D4037] text-white py-3 rounded-lg font-bold">حفظ</button>
          </div>
        </div>
      )}

      {activeModal === 'print' && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="bg-[#5D4037] text-white p-4 flex items-center">
            <button onClick={() => setActiveModal(null)} className="ml-4"><ArrowRight/></button>
            <h2 className="font-bold">خيارات الطباعة</h2>
          </div>
          <div className="divide-y">
            <div className="p-4 flex justify-between"><div><p className="font-bold">إظهار البيانات</p><p className="text-xs text-gray-400">طباعة البيانات الشخصية</p></div><button onClick={()=>toggle('printInfo')} className={`w-12 h-6 rounded-full transition-colors ${settings.printInfo?'bg-[#5D4037]':'bg-gray-300'}`}/></div>
            <div className="p-4 flex justify-between"><div><p className="font-bold">إظهار التاريخ</p><p className="text-xs text-gray-400">إظهار التاريخ أسفل الطباعة</p></div><button onClick={()=>toggle('showDate')} className={`w-12 h-6 rounded-full transition-colors ${settings.showDate?'bg-[#5D4037]':'bg-gray-300'}`}/></div>
            <div className="p-4 flex justify-between"><div><p className="font-bold">طباعة البيانات تصاعدياً</p><p className="text-xs text-gray-400">من التاريخ الأقدم للأحدث</p></div><button onClick={()=>toggle('printAsc')} className={`w-12 h-6 rounded-full transition-colors ${settings.printAsc?'bg-[#5D4037]':'bg-gray-300'}`}/></div>
          </div>
        </div>
      )}

      {activeModal === 'security' && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="bg-[#5D4037] text-white p-4 flex items-center">
            <button onClick={() => setActiveModal(null)} className="ml-4"><ArrowRight/></button>
            <h2 className="font-bold">خيارات الأمان</h2>
          </div>
          <div className="divide-y overflow-y-auto">
            <div className="p-4 flex justify-between items-center">
              <div>
                <p className="font-bold flex items-center gap-2">تفعيل كلمة السر</p>
                <p className="text-xs text-gray-500">طلب كلمة السر عند الدخول</p>
              </div>
              <button 
                onClick={() => toggle('requirePassword')} 
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.requirePassword ? 'bg-[#5D4037]' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings.requirePassword ? 'left-0.5' : 'right-0.5'}`} />
              </button>
            </div>

            {settings.requirePassword && (
              <div className="p-4 space-y-4 animate-in fade-in duration-300 bg-gray-50">
                <div>
                  <p className="font-bold flex items-center gap-2">كلمة السر</p>
                </div>
                <input 
                  type="text" 
                  className="w-full border p-3 rounded-lg outline-none focus:border-[#5D4037] text-center font-bold tracking-widest text-lg shadow-sm" 
                  placeholder="أدخل كلمة السر هنا..." 
                  value={settings.appPassword || ''} 
                  onChange={e => setSettings({...settings, appPassword: e.target.value})} 
                />
                <button 
                  onClick={() => {
                    if(!settings.appPassword) return toast.error('الرجاء إدخال كلمة سر');
                    toast.success('تم حفظ كلمة السر بنجاح ✓');
                    setActiveModal(null);
                  }} 
                  className="w-full bg-[#5D4037] text-white py-3 rounded-lg font-bold shadow-md active:scale-95 transition-transform"
                >
                  حفظ الإعدادات
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeModal === 'categories' && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-left duration-200">
          
          {selectedCatAction ? (
            <div className="bg-[#5D4037] text-white p-4 flex items-center justify-between transition-colors shadow-md z-10">
              <div className="flex items-center">
                <button onClick={() => setSelectedCatAction(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
                <h2 className="font-bold text-lg">1 محدد</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowEditCatModal({old: selectedCatAction, new: selectedCatAction})} 
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  title="تعديل"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                {selectedCatAction !== 'عام' && (
                  <button 
                    onClick={() => handleDeleteCategory(selectedCatAction)} 
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-5 h-5 text-red-300" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#5D4037] text-white p-4 flex items-center transition-colors shadow-md z-10">
              <button onClick={() => setActiveModal(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
                <ArrowRight className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-lg">التصنيفات</h2>
            </div>
          )}

          <div className="bg-gray-50 flex justify-between p-3 border-b text-sm font-bold text-gray-500">
            <span>التصنيف</span>
            <span>عدد الحسابات</span>
          </div>
          
          <div className="divide-y overflow-y-auto flex-1 select-none">
            {categories.map(cat => (
              <div 
                key={cat} 
                className={`p-4 flex items-center justify-between font-bold transition-colors cursor-pointer ${selectedCatAction === cat ? 'bg-[#5D4037]/10' : 'hover:bg-gray-50'}`}
                onTouchStart={() => handleLongPressStart(cat)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(cat)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onClick={() => {
                  if (selectedCatAction) setSelectedCatAction(selectedCatAction === cat ? null : cat);
                }}
              >
                <div className="flex items-center gap-3 w-2/3">
                  <span className={`truncate ${selectedCatAction === cat ? 'text-[#5D4037]' : 'text-gray-800'}`}>{cat}</span>
                </div>
                <span className={`w-10 text-center rounded-md py-1 ${selectedCatAction === cat ? 'bg-[#5D4037] text-white' : 'bg-gray-100'}`}>
                  {categoryCounts[cat] || 0}
                </span>
              </div>
            ))}
          </div>

          {!selectedCatAction && (
            <div className="p-4 flex justify-center border-t shadow-[0_-5px_15px_rgba(0,0,0,0.05)] bg-white">
              <button onClick={() => setShowAddCatModal(true)} className="w-14 h-14 bg-[#5D4037] rounded-full text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform">
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}

      {showAddCatModal && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-lg text-center">إضافة تصنيف جديد</h3>
            <input autoFocus className="w-full border p-3 rounded-lg outline-none focus:border-[#5D4037] text-right" placeholder="اسم التصنيف..." value={newCatName} onChange={e=>setNewCatName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAddCategory} className="flex-1 bg-[#5D4037] text-white py-2.5 rounded-lg font-bold">إضافة</button>
              <button onClick={() => {setShowAddCatModal(false); setNewCatName('');}} className="flex-1 bg-gray-200 py-2.5 rounded-lg font-bold">إلغاء</button>
            </div>
          </Card>
        </div>
      )}

      {showEditCatModal && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-lg text-center">تعديل التصنيف</h3>
            <input autoFocus className="w-full border p-3 rounded-lg outline-none focus:border-[#5D4037] text-right" value={showEditCatModal.new} onChange={e=>setShowEditCatModal({...showEditCatModal, new: e.target.value})} />
            <div className="flex gap-2">
              <button onClick={handleEditCategory} className="flex-1 bg-[#5D4037] text-white py-2.5 rounded-lg font-bold">حفظ</button>
              <button onClick={() => {setShowEditCatModal(null); setSelectedCatAction(null);}} className="flex-1 bg-gray-200 py-2.5 rounded-lg font-bold">إلغاء</button>
            </div>
          </Card>
        </div>
      )}

      {activeModal === 'backup' && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="bg-[#5D4037] text-white p-4 flex items-center shadow-md">
            <button onClick={() => setActiveModal(null)} className="ml-4"><ArrowRight/></button>
            <h2 className="font-bold text-lg">خيارات حفظ البيانات</h2>
          </div>
          
          <div className="p-5 space-y-6 overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <p className="font-bold text-gray-800">حفظ البيانات يومياً</p>
                <p className="text-xs text-gray-500 mt-1">حفظ تلقائي للنسخة الاحتياطية في التطبيق</p>
              </div>
              <button onClick={()=>toggle('dailyBackup')} className={`w-12 h-6 rounded-full transition-colors relative ${settings.dailyBackup?'bg-[#5D4037]':'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings.dailyBackup ? 'left-0.5' : 'right-0.5'}`} />
              </button>
            </div>

            <div className="space-y-3 pb-4 border-b">
              <div>
                <p className="font-bold text-gray-800">تصدير ومشاركة النسخة الاحتياطية</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  احفظ بياناتك خارج الهاتف (واتساب / Google Drive) لضمان عدم ضياعها في حال مسح التطبيق أو فرمتة الهاتف.
                </p>
              </div>
              <button
                onClick={handleBackupShare}
                className="w-full bg-[#5D4037] hover:bg-[#4a332c] text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-md active:scale-95"
              >
                <Share2 className="w-5 h-5" />
                مشاركة وحفظ النسخة الآن
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="font-bold text-gray-800">استرجاع قاعدة البيانات</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  قم برفع ملف النسخة الاحتياطية (.json) لاستعادة حساباتك السابقة.
                </p>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestoreFile} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gray-100 hover:bg-gray-200 text-[#5D4037] font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-3 border border-gray-200 active:scale-95"
              >
                <Download className="w-5 h-5" />
                رفع ملف الاسترجاع
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'other' && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="bg-[#5D4037] text-white p-4 flex items-center">
            <button onClick={() => setActiveModal(null)} className="ml-4"><ArrowRight/></button>
            <h2 className="font-bold">خيارات أخرى</h2>
          </div>
          <div className="divide-y overflow-y-auto">
            <div className="p-4 flex justify-between items-center"><div><p className="font-bold">إرسال عبر الواتس</p><p className="text-xs text-gray-400">بدل الرسائل النصية</p></div><button onClick={()=>toggle('waInsteadSms')} className={`w-12 h-6 rounded-full transition-colors ${settings.waInsteadSms?'bg-[#5D4037]':'bg-gray-300'}`}/></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
