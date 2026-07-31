/**
 * transactionGWT.js - GWT Output Database Layer
 * Frontend API helper for Google Apps Script Sheet-as-DB backend
 *
 * Usage:
 *   tx.create('abc', { def: 1, fgh: 'x' })
 *   tx.patch('defg', [{ ID: 1, abc: 1 }])
 *   tx.lookup('abc', { ID: 7 })
 *   tx.range('abc', filters)  
 * 
 * 
 * Payload untuk filter:
        {
            cmd: "range",
            sheet: "SheetName",
            value: [
                { field: "Amount", type: "n", start: 1, stop: 10 },
                { field: "OrderDate", type: "d", start: "2025-01-01", stop: "2025-12-31" }
            ]
        }

        Types:
        - n = number
        - d = date (yyyy-MM-dd)
        - t = text

        Text rules:
        (start="abc", stop="")      → starts with abc
        (start="", stop="def")      → ends with def
        (start="abc", stop="def")   → starts abc AND ends def
        (start="", stop="")         → non-empty text
 *
 *
 * Sheets:
 * - SANDBLAST (Sandblast station)
 * - DIPPING (Dipping station)
 * - SPONGING (Sponging station)
 * - SPRAY (Spray station)
 */

const SANDBLAST_SHEET = 'SANDBLAST';
const DIPPING_SHEET = 'DIPPING';
const SPONGING_SHEET = 'SPONGING';
const SPRAY_SHEET = 'SPRAY';
const TX_API_URL = 'https://script.google.com/macros/s/AKfycbwrmwNMxTJ--l-V9pCOnR0RpeQmI5JNNIElDCKz18ixBjVjU5uWHHRJeUS0DGrKkNl2/exec';

let currentEditId = null;

function setCurrentEditId(id) {
    currentEditId = id;
    console.log('🆔 currentEditId set to:', currentEditId);
}

function getCurrentEditId() {
    console.log('🆔 currentEditId returned:', currentEditId);
    return currentEditId;
}

/* ================= CORE FETCH ================= */

async function txFetch(payload) {
  try {
    console.log('📤 Sending SandDip payload:', payload);
    const res = await fetch(TX_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    console.log('📥 SandDip Response:', json);

    if (!json.success) {
      throw new Error(json.error || 'Transaction failed');
    }

    return json.data;
  } catch (error) {
    console.error('❌ txFetch error:', error);
    throw error;
  }
}

const tx = {
  create: (sheet, value) => txFetch({ cmd: 'create', sheet, value }),
  patch: (sheet, value) => txFetch({ cmd: 'patch', sheet, value }),
  lookup: (sheet, value) => txFetch({ cmd: 'lookup', sheet, value }),
  range: (sheet, value) => txFetch({ cmd: 'range', sheet, value })
};

/* ================= DATE FUNCTIONS ================= */

function formatDisplayDate(dateValue) {
    if (!dateValue) return '';
    
    const cleaned = String(dateValue).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!cleaned) return '';
    
    if (cleaned.includes('T') && cleaned.includes('Z')) {
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    }
    
    if (cleaned.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = cleaned.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    
    if (cleaned.includes('T')) {
        const datePart = cleaned.split('T')[0];
        if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = datePart.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    
    if (cleaned.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return cleaned;
    }
    
    try {
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) {}
    
    return cleaned;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const cleaned = String(dateStr).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!cleaned) return null;
    
    if (cleaned.includes('T') && cleaned.includes('Z')) {
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    if (cleaned.match(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/)) {
        const parts = cleaned.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        return new Date(
            parseInt(dateParts[2]),
            parseInt(dateParts[0]) - 1,
            parseInt(dateParts[1]),
            parseInt(timeParts[0]),
            parseInt(timeParts[1]),
            parseInt(timeParts[2])
        );
    }
    
    if (cleaned.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const parts = cleaned.split('/');
        return new Date(
            parseInt(parts[2]),
            parseInt(parts[0]) - 1,
            parseInt(parts[1])
        );
    }
    
    if (cleaned.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = cleaned.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    
    try {
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
            return date;
        }
    } catch (e) {}
    
    return null;
}

function normalizeToYYYYMMDD(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return null;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/* ================= FETCH ALL RECORDS ================= */

async function fetchAllSandDip(filters = []) {
    try {
        console.log('📊 Fetching all records from all sheets...');
        
        // Fetch from all 4 sheets
        const sandblastResults = await tx.range(SANDBLAST_SHEET, filters);
        const dippingResults = await tx.range(DIPPING_SHEET, filters);
        const spongingResults = await tx.range(SPONGING_SHEET, filters);
        const sprayResults = await tx.range(SPRAY_SHEET, filters);
        
        console.log(`📊 SANDBLAST: ${sandblastResults.length}, DIPPING: ${dippingResults.length}, SPONGING: ${spongingResults.length}, SPRAY: ${sprayResults.length}`);
        
        // Normalize SANDBLAST data
        const sandblastData = sandblastResults.map(row => {
            const timestamp = row['Timestamp'] || '';
            return {
                department: 'SANDBLAST',
                shift: row['SHIFT'] || '',
                sizeCode: row['SIZE/CODE (EX: XL2/122)'] || row['SIZE/CODE'] || '',
                factory: row['FACTORY'] || '',
                rNo: row['RR NO./TOTAL RR NO.'] || row['R NO./TOTAL RR NO.'] || '',
                quantityAccept: parseFloat(row['QUANTITY ACCEPT (PCS)']) || 0,
                quantityReject: parseFloat(row['QUANTITY REJECT (PCS)']) || 0,
                rejection: row['REJECTION'] || '',
                workerName: row['WORKER NAME'] || '',
                passingRate: row['PASSING RATE'] || '',
                createdDate: timestamp,
                _original: row
            };
        });
        
        // Normalize DIPPING data
        const dippingData = dippingResults.map(row => {
            const timestamp = row['Timestamp'] || '';
            return {
                department: 'DIPPING',
                shift: row['SHIFT'] || '',
                sizeCode: row['SIZE/CODE (EX: XL2/122)'] || row['SIZE/CODE'] || '',
                factory: row['FACTORY'] || '',
                rNo: row['RR NO./TOTAL RR NO.'] || '',
                quantityAccept: parseFloat(row['QUANTITY ACCEPT (PCS)']) || 0,
                quantityReject: parseFloat(row['QUANTITY REJECT (PCS)']) || 0,
                rejection: row['REJECTION'] || '',
                workerName: row['WORKER NAME'] || '',
                passingRate: row['PASSING RATE'] || '',
                createdDate: timestamp,
                _original: row
            };
        });
        
        // Normalize SPONGING data
        const spongingData = spongingResults.map(row => {
            const timestamp = row['Timestamp'] || '';
            return {
                department: 'SPONGING',
                shift: row['SHIFT'] || '',
                sizeCode: row['SIZE/CODE (EX: XL2/122)'] || row['SIZE/CODE'] || '',
                factory: row['FACTORY'] || '',
                rNo: row['RR NO./TOTAL RR NO.'] || '',
                quantityAccept: parseFloat(row['QUANTITY ACCEPT (PCS)']) || 0,
                quantityReject: parseFloat(row['QUANTITY REJECT (PCS)']) || 0,
                rejection: row['REJECTION'] || '',
                workerName: row['WORKER NAME'] || '',
                passingRate: row['PASSING RATE'] || '',
                createdDate: timestamp,
                _original: row
            };
        });
        
        // Normalize SPRAY data
        const sprayData = sprayResults.map(row => {
            const timestamp = row['Timestamp'] || '';
            return {
                department: 'SPRAY',
                shift: row['SHIFT'] || '',
                sizeCode: row['SIZE/CODE (EX: XL2/122)'] || row['SIZE/CODE'] || '',
                factory: row['FACTORY'] || '',
                rNo: row['RR NO./TOTAL RR NO.'] || '',
                quantityAccept: parseFloat(row['QUANTITY ACCEPT (PCS)']) || 0,
                quantityReject: parseFloat(row['QUANTITY REJECT (PCS)']) || 0,
                rejection: row['REJECTION'] || '',
                workerName: row['WORKER NAME'] || '',
                passingRate: row['PASSING RATE'] || '',
                createdDate: timestamp,
                _original: row
            };
        });
        
        const combined = [...sandblastData, ...dippingData, ...spongingData, ...sprayData];
        combined.sort((a, b) => {
            const dateA = a.createdDate ? parseDate(a.createdDate) : new Date(0);
            const dateB = b.createdDate ? parseDate(b.createdDate) : new Date(0);
            if (!dateA || !dateB) return 0;
            return dateB - dateA;
        });
        
        console.log(`📊 Total combined records: ${combined.length}`);
        return combined;
        
    } catch (error) {
        console.error('❌ fetchAllSandDip error:', error);
        return [];
    }
}

/* ================= SEARCH FUNCTION ================= */

async function searchByDateSizeDept(fromDate, toDate, sizeCode, department) {
    try {
        console.log('🔍 Searching with filters:', { fromDate, toDate, sizeCode, department });
        
        const allData = await fetchAllSandDip([]);
        console.log(`📊 Total records: ${allData.length}`);
        
        if (allData.length === 0) return [];
        
        let filtered = [...allData];
        
        // ===== FILTER BY DATE RANGE =====
        if (fromDate && toDate) {
            const fromDateObj = parseDate(fromDate);
            const toDateObj = parseDate(toDate);
            
            if (fromDateObj && toDateObj && !isNaN(fromDateObj.getTime()) && !isNaN(toDateObj.getTime())) {
                const fromDateStr = normalizeToYYYYMMDD(fromDateObj);
                const toDateStr = normalizeToYYYYMMDD(toDateObj);
                
                console.log(`📅 Filter range: ${fromDateStr} to ${toDateStr}`);
                
                filtered = filtered.filter(row => {
                    const rowDateStr = row.createdDate || '';
                    if (!rowDateStr) return false;
                    
                    const rowDateObj = parseDate(rowDateStr);
                    if (!rowDateObj || isNaN(rowDateObj.getTime())) {
                        return false;
                    }
                    
                    const rowDateStrNormalized = normalizeToYYYYMMDD(rowDateObj);
                    return rowDateStrNormalized >= fromDateStr && rowDateStrNormalized <= toDateStr;
                });
                
                console.log(`After date filter: ${filtered.length} records`);
            }
        }
        
        // ===== FILTER BY SIZE/CODE =====
        if (sizeCode && sizeCode.trim() !== '') {
            const searchTerm = sizeCode.trim();
            const searchLower = searchTerm.toLowerCase();
            
            console.log(`🔍 Searching for size code: "${searchTerm}"`);
            
            filtered = filtered.filter(row => {
                const rowSize = (row.sizeCode || '').toLowerCase();
                return rowSize.includes(searchLower);
            });
            
            console.log(`After size filter: ${filtered.length} records`);
        }
        
        // ===== FILTER BY DEPARTMENT =====
        if (department && department !== 'all') {
            filtered = filtered.filter(row => row.department === department);
            console.log(`After department filter: ${filtered.length} records`);
        }
        
        filtered.sort((a, b) => {
            const dateA = a.createdDate ? parseDate(a.createdDate) : new Date(0);
            const dateB = b.createdDate ? parseDate(b.createdDate) : new Date(0);
            if (!dateA || !dateB) return 0;
            return dateB - dateA;
        });
        
        console.log(`✅ Final: ${filtered.length} records found`);
        return filtered;
        
    } catch (error) {
        console.error('Error in searchByDateSizeDept:', error);
        return [];
    }
}

/* ================= UPDATE RECORD ================= */

async function updateSandDipRecord(refId, data, department) {
    try {
        console.log('🆔 Updating record ID:', refId, 'Department:', department);
        
        // Determine which sheet to update
        let sheetName;
        if (department === 'SANDBLAST') {
            sheetName = SANDBLAST_SHEET;
        } else if (department === 'DIPPING') {
            sheetName = DIPPING_SHEET;
        } else if (department === 'SPONGING') {
            sheetName = SPONGING_SHEET;
        } else if (department === 'SPRAY') {
            sheetName = SPRAY_SHEET;
        } else {
            throw new Error('Unknown department: ' + department);
        }
        
        // Fetch the original record
        const existingRecords = await tx.range(sheetName, [
            { field: 'ID', type: 't', start: String(refId), stop: '' }
        ]);
        
        if (!existingRecords || existingRecords.length === 0) {
            console.error('❌ Record not found for ID:', refId);
            throw new Error('Record not found for ID: ' + refId);
        }
        
        const originalRecord = existingRecords[0];
        console.log('📄 Original record:', originalRecord);
        
        // Build update data - all departments use same columns
        let updateData = {
            'ID': String(refId),
            'SHIFT': data.shift || '',
            'SIZE/CODE (EX: XL2/122)': data.sizeCode || '',
            'FACTORY': data.factory || '',
            'RR NO./TOTAL RR NO.': data.rNo || '',
            'QUANTITY ACCEPT (PCS)': data.quantityAccept || '0',
            'QUANTITY REJECT (PCS)': data.quantityReject || '0',
            'REJECTION': data.rejection || '',
            'WORKER NAME': data.workerName || '',
            'PASSING RATE': data.passingRate || ''
        };
        
        console.log('📤 Sending UPDATE (PATCH):', updateData);
        
        const result = await tx.patch(sheetName, [updateData]);
        console.log('✅ Update result:', result);
        return result;
        
    } catch (error) {
        console.error('❌ updateSandDipRecord error:', error);
        throw error;
    }
}

/* ================= INITIALIZATION ================= */

async function initializeSandDipDatabase() {
    console.log('🔄 Initializing Sandblast & Dipping database...');
    
    try {
        const testData = await fetchAllSandDip([]);
        console.log(`📊 Combined records: ${testData.length}`);
        console.log('✅ SandDip database ready');
        return { success: true, recordCount: testData.length };
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        return { success: false, error: error.message };
    }
}

// Auto-initialize
(async function autoInitialize() {
    try {
        await initializeSandDipDatabase();
    } catch (error) {
        console.error('❌ Auto-initialization failed:', error);
    }
})();

/* ================= EXPORT ================= */

window.SANDDIP_DB = {
    tx,
    initialize: initializeSandDipDatabase,
    fetchAllSandDip,
    searchByDateSizeDept,
    updateSandDipRecord,
    formatDisplayDate,
    parseDate,
    normalizeToYYYYMMDD,
    setCurrentEditId,
    getCurrentEditId,
    SANDBLAST_SHEET,
    DIPPING_SHEET,
    SPONGING_SHEET,
    SPRAY_SHEET,  
    VERSION: '1.0.0'
};

console.log('✅ Sandblast & Dipping Database module loaded (Version 1.0.5)');
