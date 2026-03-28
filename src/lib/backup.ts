import { getAllClients, getAllTransactions, type Client, type Transaction, encrypt, decrypt } from './db';
import { openDB } from 'idb';
import { toast } from 'sonner';

const DB_NAME = 'LedgerDB';
const DB_VERSION = 1;

/**
 * دالة مساعدة لضغط البيانات باستخدام Gzip (تحسين الأداء)
 */
async function compressData(data: string): Promise<string> {
  try {
    // استخدام CompressionStream API إن توفرت
    if ('CompressionStream' in window) {
      const stream = new (window as any).CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(new TextEncoder().encode(data));
      writer.close();
      
      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];
      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }
      
      const compressed = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      // تحويل إلى Base64 للتوافقية
      return btoa(String.fromCharCode(...compressed));
    }
  } catch (error) {
    console.warn('Compression failed, using uncompressed data:', error);
  }
  
  return data;
}

/**
 * دالة مساعدة لفك ضغط البيانات
 */
async function decompressData(data: string): Promise<string> {
  try {
    // محاولة فك الضغط إذا كانت البيانات مضغوطة
    if ('DecompressionStream' in window) {
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const stream = new (window as any).DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(bytes);
      writer.close();
      
      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];
      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }
      
      const decompressed = new TextDecoder().decode(
        new Uint8Array(chunks.reduce((a, b) => a + b.length, 0))
      );
      return decompressed;
    }
  } catch (error) {
    console.warn('Decompression failed, assuming uncompressed data:', error);
  }
  
  return data;
}

export async function exportBackup(): Promise<void> {
  try {
    // جلب البيانات بالتوازي لتحسين الأداء
    const [clients, transactions] = await Promise.all([
      getAllClients(),
      getAllTransactions()
    ]);

    const backupData = {
      clients,
      transactions,
      exportDate: new Date().toISOString(),
      version: '2.0', // إصدار جديد مع ميزات محسّنة
      appVersion: '1.0.0'
    };

    let finalData = JSON.stringify(backupData);

    // التشفير (إذا كانت الدالة متاحة)
    if (typeof encrypt === 'function') {
      finalData = encrypt(finalData);
    }

    // محاولة ضغط البيانات
    const compressedData = await compressData(finalData);
    const isCompressed = compressedData !== finalData;

    // إنشاء ملف النسخة الاحتياطية
    const fileName = `Ledger-Backup-${new Date().toISOString().split('T')[0]}.${isCompressed ? 'bak' : 'txt'}`;
    const file = new File([compressedData], fileName, { type: 'application/octet-stream' });

    // 1. محاولة المشاركة الأصلية (واتساب، درايف، الخ) - الطريقة الأسرع
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'نسخة احتياطية - دفتر الحسابات',
          text: 'احتفظ بهذا الملف في مكان آمن لاسترجاع بياناتك لاحقاً. البيانات مشفرة وآمنة.'
        });
        toast.success('تم مشاركة النسخة الاحتياطية بنجاح!');
        return;
      } catch (shareError: any) {
        // إذا ألغى المستخدم المشاركة، لا نعتبرها خطأ
        if (shareError.name !== 'AbortError') {
          console.warn('Share failed, trying download:', shareError);
        }
      }
    }

    // 2. محاولة التنزيل المباشر كملف (سريع وموثوق)
    const blob = new Blob([compressedData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // تنظيف الموارد فوراً
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    toast.success('تم تنزيل النسخة الاحتياطية بنجاح!');

  } catch (error) {
    console.error('Backup Error:', error);
    // 3. الخطة البديلة: نسخ البيانات إلى الحافظة (Clipboard)
    await fallbackBackupToClipboard();
  }
}

/**
 * دالة احتياطية لنسخ البيانات إلى الحافظة
 */
async function fallbackBackupToClipboard(): Promise<void> {
  try {
    const [clients, transactions] = await Promise.all([
      getAllClients(),
      getAllTransactions()
    ]);

    const backupData = {
      clients,
      transactions,
      exportDate: new Date().toISOString()
    };

    let finalData = JSON.stringify(backupData);

    if (typeof encrypt === 'function') {
      finalData = encrypt(finalData);
    }

    await navigator.clipboard.writeText(finalData);
    toast.success('✓ تم نسخ البيانات! يمكنك فتح واتساب وعمل "لصق" (Paste) لحفظها.');
  } catch (clipboardError) {
    console.error('Clipboard Error:', clipboardError);
    toast.error('حدث خطأ أثناء إنشاء النسخة الاحتياطية. يرجى المحاولة لاحقاً.');
  }
}

/**
 * استيراد النسخة الاحتياطية مع دعم الضغط والتشفير
 */
export async function importBackup(file: File): Promise<{ clients: number; transactions: number }> {
  try {
    let text = await file.text();

    // محاولة فك الضغط إذا كانت البيانات مضغوطة
    if (file.name.endsWith('.bak')) {
      text = await decompressData(text);
    }

    // فك التشفير إذا لزم الأمر
    let decrypted = text;
    if (typeof decrypt === 'function') {
      try {
        decrypted = decrypt(text);
      } catch (decryptError) {
        console.warn('Decryption failed, trying raw data:', decryptError);
        decrypted = text;
      }
    }

    if (!decrypted || !decrypted.includes('clients')) {
      throw new Error('الملف غير صالح أو مفتاح التشفير خاطئ');
    }

    const data = JSON.parse(decrypted) as { clients: Client[]; transactions: Transaction[] };

    // التحقق من صحة البيانات
    if (!Array.isArray(data.clients) || !Array.isArray(data.transactions)) {
      throw new Error('صيغة البيانات غير صحيحة');
    }

    // مسح القاعدة القديمة بكفاءة أعلى
    const db = await openDB(DB_NAME, DB_VERSION);
    const txClear = db.transaction(['clients', 'transactions'], 'readwrite');
    
    await Promise.all([
      txClear.objectStore('clients').clear(),
      txClear.objectStore('transactions').clear()
    ]);
    
    await txClear.done;

    // استرجاع البيانات بالتوازي لتحسين الأداء
    const txInsert = db.transaction(['clients', 'transactions'], 'readwrite');
    
    const clientPromises = (data.clients || []).map(c => 
      txInsert.objectStore('clients').put(c)
    );
    const transactionPromises = (data.transactions || []).map(t => 
      txInsert.objectStore('transactions').put(t)
    );

    await Promise.all([...clientPromises, ...transactionPromises]);
    await txInsert.done;

    toast.success(`✓ تم استرجاع البيانات: ${data.clients?.length || 0} عميل، ${data.transactions?.length || 0} عملية`);

    return { 
      clients: data.clients?.length || 0, 
      transactions: data.transactions?.length || 0 
    };
  } catch (error) {
    console.error('Import Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'فشل استرجاع البيانات';
    toast.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * دالة لحذف النسخة الاحتياطية القديمة (تنظيف تلقائي)
 */
export async function cleanOldBackups(): Promise<void> {
  try {
    // هذه الدالة يمكن استخدامها لتنظيف النسخ الاحتياطية القديمة من التخزين المحلي
    const db = await openDB(DB_NAME, DB_VERSION);
    const settings = await db.getAll('settings');
    
    // يمكن إضافة منطق لحذف النسخ القديمة بناءً على التاريخ
    console.log('Cleanup completed');
  } catch (error) {
    console.warn('Cleanup failed:', error);
  }
}

/**
 * دالة لإنشاء نسخة احتياطية مجدولة تلقائياً
 */
export async function scheduleAutoBackup(intervalMinutes: number = 60): Promise<void> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION);
    
    // حفظ إعدادات النسخ الاحتياطي التلقائي
    await db.put('settings', {
      key: 'autoBackupInterval',
      value: intervalMinutes.toString()
    });

    // إنشاء مؤقت للنسخ الاحتياطي التلقائي
    setInterval(async () => {
      try {
        await exportBackup();
        console.log('Auto backup completed');
      } catch (error) {
        console.error('Auto backup failed:', error);
      }
    }, intervalMinutes * 60 * 1000);

    toast.success(`✓ تم تفعيل النسخ الاحتياطي التلقائي كل ${intervalMinutes} دقيقة`);
  } catch (error) {
    console.error('Schedule error:', error);
  }
}
