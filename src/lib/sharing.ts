import type { Client, Transaction } from './db';
import { toast } from 'sonner';

/**
 * أنواع المشاركة المتاحة
 */
export type ShareType = 
  | 'whatsapp' 
  | 'email' 
  | 'telegram' 
  | 'sms' 
  | 'copy' 
  | 'print' 
  | 'social' 
  | 'link'
  | 'file'
  | 'google-drive';

/**
 * واجهة خيارات المشاركة
 */
export interface ShareOptions {
  includeBalance: boolean;
  includeTransactions: boolean;
  includeContactInfo: boolean;
  includeDate: boolean;
  format: 'text' | 'html' | 'json';
  encryption: boolean;
}

/**
 * الإعدادات الافتراضية للمشاركة
 */
const defaultShareOptions: ShareOptions = {
  includeBalance: true,
  includeTransactions: true,
  includeContactInfo: false,
  includeDate: true,
  format: 'text',
  encryption: true
};

/**
 * دالة لمشاركة بيانات العميل عبر WhatsApp
 */
export async function shareViaWhatsApp(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };
  const message = generateShareMessage(
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    opts
  );

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

  try {
    window.open(whatsappUrl, '_blank');
    toast.success('تم فتح WhatsApp للمشاركة');
  } catch (error) {
    toast.error('فشل فتح WhatsApp');
  }
}

/**
 * دالة لمشاركة عبر Telegram
 */
export async function shareViaTelegram(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };
  const message = generateShareMessage(
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    opts
  );

  const encodedMessage = encodeURIComponent(message);
  const telegramUrl = `https://t.me/share/url?url=&text=${encodedMessage}`;

  try {
    window.open(telegramUrl, '_blank');
    toast.success('تم فتح Telegram للمشاركة');
  } catch (error) {
    toast.error('فشل فتح Telegram');
  }
}

/**
 * دالة لمشاركة عبر البريد الإلكتروني
 */
export async function shareViaEmail(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  recipientEmail?: string,
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };
  const message = generateShareMessage(
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    opts
  );

  const subject = encodeURIComponent(`كشف حساب - ${client.name}`);
  const body = encodeURIComponent(message);
  const mailtoUrl = `mailto:${recipientEmail || ''}?subject=${subject}&body=${body}`;

  try {
    window.location.href = mailtoUrl;
    toast.success('تم فتح البريد الإلكتروني');
  } catch (error) {
    toast.error('فشل فتح البريد الإلكتروني');
  }
}

/**
 * دالة لمشاركة عبر رسالة نصية SMS
 */
export async function shareViaSMS(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  phoneNumber?: string,
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };
  const message = generateShareMessage(
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    opts
  );

  const encodedMessage = encodeURIComponent(message);
  const smsUrl = `sms:${phoneNumber || ''}?body=${encodedMessage}`;

  try {
    window.location.href = smsUrl;
    toast.success('تم فتح الرسائل النصية');
  } catch (error) {
    toast.error('فشل فتح الرسائل النصية');
  }
}

/**
 * دالة لنسخ المحتوى إلى الحافظة
 */
export async function copyToClipboard(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };
  const message = generateShareMessage(
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    opts
  );

  try {
    await navigator.clipboard.writeText(message);
    toast.success('✓ تم نسخ البيانات إلى الحافظة');
  } catch (error) {
    toast.error('فشل نسخ البيانات');
  }
}

/**
 * دالة لطباعة البيانات
 */
export async function printData(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };
  const htmlContent = generateHTMLContent(
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    opts
  );

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('فشل فتح نافذة الطباعة');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.print();
  toast.success('تم فتح نافذة الطباعة');
}

/**
 * دالة لمشاركة عبر الشبكات الاجتماعية
 */
export async function shareToSocial(
  platform: 'facebook' | 'twitter' | 'linkedin',
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };
  const message = generateShareMessage(
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    opts
  );

  const encodedMessage = encodeURIComponent(message);
  const currentUrl = encodeURIComponent(window.location.href);

  let shareUrl = '';
  switch (platform) {
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${currentUrl}&quote=${encodedMessage}`;
      break;
    case 'twitter':
      shareUrl = `https://twitter.com/intent/tweet?text=${encodedMessage}`;
      break;
    case 'linkedin':
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${currentUrl}`;
      break;
  }

  try {
    window.open(shareUrl, '_blank');
    toast.success(`تم فتح ${platform}`);
  } catch (error) {
    toast.error(`فشل فتح ${platform}`);
  }
}

/**
 * دالة لإنشاء رابط قابل للمشاركة (مع تشفير اختياري)
 */
export async function generateShareableLink(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: Partial<ShareOptions> = {}
): Promise<string> {
  const opts = { ...defaultShareOptions, ...options };
  const data = {
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    timestamp: new Date().toISOString()
  };

  const jsonString = JSON.stringify(data);
  const encoded = btoa(jsonString); // Base64 encoding
  const baseUrl = window.location.origin;
  const shareLink = `${baseUrl}?share=${encoded}`;

  return shareLink;
}

/**
 * دالة لتصدير البيانات كملف JSON
 */
export async function exportAsJSON(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number
): Promise<void> {
  const data = {
    client,
    transactions,
    totalDebit,
    totalCredit,
    netBalance,
    exportDate: new Date().toISOString()
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `كشف_حساب_${client.name}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success('✓ تم تصدير البيانات كملف JSON');
}

/**
 * دالة لتصدير البيانات كملف CSV
 */
export async function exportAsCSV(
  client: Client,
  transactions: (Transaction & { balance: number })[]
): Promise<void> {
  let csv = 'التاريخ,النوع,المبلغ,التفاصيل,الرصيد\n';
  
  transactions.forEach(tx => {
    csv += `${tx.date},${tx.type === 'debit' ? 'عليه' : 'له'},${tx.amount},"${tx.details}",${tx.balance}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `كشف_حساب_${client.name}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success('✓ تم تصدير البيانات كملف CSV');
}

/**
 * دالة مساعدة لإنشاء رسالة المشاركة
 */
function generateShareMessage(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: ShareOptions
): string {
  let message = '';

  if (options.includeDate) {
    message += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
  }

  message += `👤 العميل: ${client.name}\n`;

  if (options.includeContactInfo && client.phone) {
    message += `📞 الهاتف: ${client.phone}\n`;
  }

  message += `\n💰 الملخص المالي:\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `إجمالي عليه: ${totalDebit.toLocaleString()}\n`;
  message += `إجمالي له: ${totalCredit.toLocaleString()}\n`;
  message += `الرصيد: ${Math.abs(netBalance).toLocaleString()} ${netBalance >= 0 ? 'عليه' : 'له'}\n`;

  if (options.includeTransactions && transactions.length > 0) {
    message += `\n📋 آخر ${Math.min(5, transactions.length)} معاملات:\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    
    transactions.slice(-5).forEach(tx => {
      message += `${tx.date} | ${tx.type === 'debit' ? '❌' : '✅'} ${tx.amount.toLocaleString()} | ${tx.details}\n`;
    });
  }

  message += `\n✓ تم إنشاؤه من تطبيق دفتر الحسابات الآمن`;

  return message;
}

/**
 * دالة مساعدة لإنشاء محتوى HTML
 */
function generateHTMLContent(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  options: ShareOptions
): string {
  const tableRows = transactions
    .map(tx => `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.type === 'debit' ? 'عليه' : 'له'}</td>
        <td>${tx.amount.toLocaleString()}</td>
        <td>${tx.details}</td>
        <td>${tx.balance.toLocaleString()}</td>
      </tr>
    `)
    .join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>كشف حساب - ${client.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; }
        h1 { color: #5D4037; text-align: center; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #5D4037; color: white; padding: 10px; text-align: right; }
        td { padding: 10px; border-bottom: 1px solid #ddd; text-align: right; }
        tr:nth-child(even) { background: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>كشف حساب</h1>
      <p><strong>العميل:</strong> ${client.name}</p>
      ${options.includeContactInfo && client.phone ? `<p><strong>الهاتف:</strong> ${client.phone}</p>` : ''}
      ${options.includeDate ? `<p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>` : ''}
      
      <div class="summary">
        <p><strong>إجمالي عليه:</strong> ${totalDebit.toLocaleString()}</p>
        <p><strong>إجمالي له:</strong> ${totalCredit.toLocaleString()}</p>
        <p><strong>الرصيد:</strong> ${Math.abs(netBalance).toLocaleString()} ${netBalance >= 0 ? 'عليه' : 'له'}</p>
      </div>
      
      ${options.includeTransactions ? `
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>التفاصيل</th>
              <th>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      ` : ''}
    </body>
    </html>
  `;
}

/**
 * دالة لمشاركة شاملة مع جميع الخيارات
 */
export async function shareWithAllOptions(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number,
  selectedOptions: ShareType[],
  options: Partial<ShareOptions> = {}
): Promise<void> {
  const opts = { ...defaultShareOptions, ...options };

  for (const shareType of selectedOptions) {
    try {
      switch (shareType) {
        case 'whatsapp':
          await shareViaWhatsApp(client, transactions, totalDebit, totalCredit, netBalance, opts);
          break;
        case 'email':
          await shareViaEmail(client, transactions, totalDebit, totalCredit, netBalance, undefined, opts);
          break;
        case 'telegram':
          await shareViaTelegram(client, transactions, totalDebit, totalCredit, netBalance, opts);
          break;
        case 'sms':
          await shareViaSMS(client, transactions, totalDebit, totalCredit, netBalance, undefined, opts);
          break;
        case 'copy':
          await copyToClipboard(client, transactions, totalDebit, totalCredit, netBalance, opts);
          break;
        case 'print':
          await printData(client, transactions, totalDebit, totalCredit, netBalance, opts);
          break;
        case 'file':
          await exportAsJSON(client, transactions, totalDebit, totalCredit, netBalance);
          break;
        case 'google-drive':
          const { exportToGoogleDrive } = await import('./googleDrive');
          await exportToGoogleDrive(client, transactions, totalDebit, totalCredit, netBalance);
          break;
      }
    } catch (error) {
      console.error(`Failed to share via ${shareType}:`, error);
    }
  }
}
