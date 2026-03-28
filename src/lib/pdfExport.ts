import type { Client, Transaction } from './db';

// تخزين مؤقت للمكتبات المستوردة لتحسين الأداء
let html2pdfModule: any = null;
let isLoadingModule = false;

async function getHtml2PdfModule() {
  if (html2pdfModule) return html2pdfModule;
  
  if (isLoadingModule) {
    // انتظر إذا كانت المكتبة قيد التحميل
    while (!html2pdfModule && isLoadingModule) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return html2pdfModule;
  }

  isLoadingModule = true;
  try {
    const module = await import('html2pdf.js');
    html2pdfModule = (module as any).default || (module as any);
    return html2pdfModule;
  } finally {
    isLoadingModule = false;
  }
}

export async function exportLedgerPDF(
  client: Client,
  transactions: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number
): Promise<Blob> {
  // التأكد من أن الكود يعمل في المتصفح فقط
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PDF generation must run on the client side.'));
  }

  // ترتيب المعاملات: الأقدم فوق والأحدث تحت
  const sortedTxns = [...transactions].reverse();
  
  // إنشاء HTML محسّن للأداء
  const html = generatePDFHTML(client, sortedTxns, totalDebit, totalCredit, netBalance);

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  try {
    const element = container.querySelector('#pdf-content') as HTMLElement;
    
    // تحميل المكتبة مع التخزين المؤقت
    const html2pdf = await getHtml2PdfModule();

    // إعدادات محسّنة للأداء والسلاسة
    const blob: Blob = await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename: `كشف_حساب_${client.name}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 1.5,
          useCORS: true, 
          letterRendering: true,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        },
      })
      .from(element)
      .output('blob'); 

    return blob;
  } finally {
    // تنظيف الموارد فوراً
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * دالة مساعدة لإنشاء HTML محسّن للأداء
 */
function generatePDFHTML(
  client: Client,
  sortedTxns: (Transaction & { balance: number })[],
  totalDebit: number,
  totalCredit: number,
  netBalance: number
): string {
  const exportDate = new Date().toLocaleDateString('ar-EG');
  
  const tableRows = sortedTxns
    .map((tx, i) => `
      <tr style="background: ${i % 2 === 0 ? '#faf5eb' : '#ffffff'};">
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e5ddd0;">${tx.date}</td>
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e5ddd0; color: ${tx.type === 'debit' ? '#b91c1c' : '#15803d'}; font-weight: bold;">
          ${tx.amount.toLocaleString()} ${tx.type === 'debit' ? '(-)' : '(+)'}
        </td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e5ddd0; max-width: 150px; word-wrap: break-word;">${tx.details}</td>
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e5ddd0;">${tx.balance.toLocaleString()}</td>
      </tr>
    `)
    .join('');

  return `
    <div id="pdf-content" style="direction: rtl; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; padding: 20px; width: 210mm; background: white; color: #3c2814;">
      
      <div style="background: linear-gradient(135deg, #4a341c 0%, #5a4a2c 100%); color: #f5eee1; padding: 16px 20px; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">كشف حساب</h1>
        <p style="margin: 4px 0 0; font-size: 16px; font-weight: 500;">${client.name}</p>
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 12px; font-size: 12px; color: #666;">
        ${client.phone ? `<span>📞 الهاتف: ${client.phone}</span>` : ''}
        <span>📅 تاريخ التصدير: ${exportDate}</span>
      </div>
      
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <div style="flex:1; background: #fee2e2; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #fca5a5;">
          <div style="font-size: 11px; color: #b91c1c; font-weight: 600;">إجمالي عليه</div>
          <div style="font-size: 16px; font-weight: bold; color: #b91c1c;">${totalDebit.toLocaleString()}</div>
        </div>
        <div style="flex:1; background: #dcfce7; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #86efac;">
          <div style="font-size: 11px; color: #15803d; font-weight: 600;">إجمالي له</div>
          <div style="font-size: 16px; font-weight: bold; color: #15803d;">${totalCredit.toLocaleString()}</div>
        </div>
        <div style="flex:1; background: #fef3c7; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #fde047;">
          <div style="font-size: 11px; color: #92400e; font-weight: 600;">الرصيد</div>
          <div style="font-size: 16px; font-weight: bold; color: #92400e;">${Math.abs(netBalance).toLocaleString()} ${netBalance >= 0 ? 'عليه' : 'له'}</div>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #d4af37;">
        <thead>
          <tr style="background: #4a341c; color: #f5eee1;">
            <th style="padding: 10px 8px; text-align: center; font-weight: bold; border-right: 1px solid #8b7355;">التاريخ</th>
            <th style="padding: 10px 8px; text-align: center; font-weight: bold; border-right: 1px solid #8b7355;">المبلغ</th>
            <th style="padding: 10px 8px; text-align: right; font-weight: bold; border-right: 1px solid #8b7355;">التفاصيل</th>
            <th style="padding: 10px 8px; text-align: center; font-weight: bold;">الرصيد</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div style="margin-top: 20px; padding-top: 12px; border-top: 2px solid #d4af37; text-align: center;">
        <p style="font-size: 11px; color: #78644e; margin: 0;">
          ✓ تم التصدير من تطبيق دفتر الحسابات - آمن وموثوق
        </p>
        <p style="font-size: 10px; color: #999; margin: 4px 0 0;">
          هذا الملف يحتوي على بيانات حساسة - يرجى الاحتفاظ به في مكان آمن
        </p>
      </div>
    </div>
  `;
}

/**
 * دالة لتصدير عدة كشوفات حسابات دفعة واحدة (مع تحسين الأداء)
 */
export async function exportMultiplePDFs(
  clients: Array<{
    client: Client;
    transactions: (Transaction & { balance: number })[];
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
  }>
): Promise<Blob[]> {
  const blobs: Blob[] = [];
  
  for (const item of clients) {
    try {
      const blob = await exportLedgerPDF(
        item.client,
        item.transactions,
        item.totalDebit,
        item.totalCredit,
        item.netBalance
      );
      blobs.push(blob);
      // إضافة تأخير صغير بين التصديرات لتجنب الحمل الزائد
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to export PDF for ${item.client.name}:`, error);
    }
  }
  
  return blobs;
}
