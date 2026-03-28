import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
// شلنا أيقونات الـ Upload والـ Download لأننا ما محتاجينهم هنا تاني
import {
  Plus, Table2, FileText, Calendar, LayoutGrid,
  Settings, Share2, X, Info
} from 'lucide-react';

const MainMenu = () => {
  const navigate = useNavigate();
  const [showAbout, setShowAbout] = useState(false);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'دفتر الحسابات', text: 'تطبيق دفتر حسابات آمن ومشفر بالكامل', url: window.location.origin });
    } else {
      navigator.clipboard.writeText(window.location.origin);
      toast.success('تم نسخ الرابط ✓');
    }
  };

  const handleExit = () => {
    window.close();
    navigate('/');
  };

  // شلنا زراير النسخ والاسترجاع من القائمة دي نهائياً
  const menuItems = [
    { icon: Plus, label: 'إضافة مبلغ', color: 'text-credit', action: () => navigate('/add-transaction') },
    { icon: Table2, label: 'تقرير- إجمالي المبالغ', color: 'text-menu-icon', action: () => navigate('/reports?type=total') },
    { icon: FileText, label: 'تقرير- تفاصيل كل المبالغ', color: 'text-menu-icon', action: () => navigate('/reports?type=details') },
    { icon: Calendar, label: 'تقرير- إجمالي المبالغ شهرياً', color: 'text-menu-icon', action: () => navigate('/reports?type=monthly') },
    { icon: LayoutGrid, label: 'تقرير- إجمالي التصنيفات', color: 'text-menu-icon', action: () => navigate('/reports?type=categories') },
    { icon: Settings, label: 'إعدادات', color: 'text-menu-icon', action: () => navigate('/settings') },
    { icon: Info, label: 'حول البرنامج', color: 'text-menu-icon', action: () => setShowAbout(true) },
    { icon: Share2, label: 'مشاركة البرنامج', color: 'text-menu-icon', action: handleShare },
    { icon: X, label: 'خروج', color: 'text-debit', action: handleExit },
  ];

  return (
    <div className="min-h-screen bg-background pb-4">
      <AppHeader title="القائمة الرئيسية" showBack />
      
      {/* شلنا سطر الـ input المخفي بتاع رفع الملفات من هنا */}

      <div className="p-3 space-y-3">
        <Card className="shadow-lg border-0 overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-0">
            <nav className="divide-y divide-border">
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  onClick={item.action}
                  className="flex items-center gap-4 w-full px-5 py-4 hover:bg-muted active:bg-muted/70 transition-all text-right animate-fade-in"
                  style={{ animationDelay: `${(i + 2) * 40}ms` }}
                >
                  <item.icon className={`w-6 h-6 flex-shrink-0 ${item.color}`} />
                  <span className="text-base font-semibold text-foreground">{item.label}</span>
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>
      </div>

      {showAbout && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowAbout(false)}>
          <Card className="w-80 shadow-xl border-0 animate-scale-in" onClick={e => e.stopPropagation()}>
            <CardContent className="p-6 text-center space-y-3">
              <Info className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-xl font-bold text-foreground">دفتر الحسابات</h2>
              <p className="text-sm text-foreground leading-relaxed">تطبيق لإدارة حسابات العملاء والديون بشكل آمن ومحلي.</p>
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-semibold text-muted-foreground">المطورين</p>
                <p className="text-sm text-foreground mt-1">رقم المطور: 0114866251</p>
              </div>
              <button onClick={() => setShowAbout(false)} className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-bold mt-2">إغلاق</button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
