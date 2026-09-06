/* =========================================================
   Velvet Hands — script.js
   Shared across product.html, order.html, admin.html.
   Each page's logic only runs if that page's elements exist.
   ========================================================= */

const PRODUCTS_JSON_PATH = 'products.json';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxRjrzucAGq38NWpFGIf3DzrdkPGfDrkcgJOBBrJztRAKDo4NKjM9RW3uUTtdZPdf0/exec';
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnNaTU_ehL6RnyzPZGV-jy_GgedZvHETBVanb46fp5Iv8jepssQft4Yegq9Rnq02b1jYLplg8pAhA5/pub?gid=0&single=true&output=csv';

const MOOD_LABELS = {
  all: 'ทั้งหมด',
  deepnourish: 'DeepNourish',
  citrusglow: 'CitrusGlow',
  zenwood: 'ZenWood',
  silkbloom: 'SilkBloom'
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------------------------------------------------------
   1) product.html — filter bar + product cards
   --------------------------------------------------------- */
function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const productList = document.getElementById('product-list');

  fetch(PRODUCTS_JSON_PATH)
    .then((res) => res.json())
    .then((products) => {
      const urlParams = new URLSearchParams(window.location.search);
      const initialMood = urlParams.get('mood') || 'all';

      renderFilterBar(filterBar, initialMood, (mood) => {
        renderProductList(productList, products, mood);
      });

      renderProductList(productList, products, initialMood);
    })
    .catch((error) => {
      console.error(error);
      productList.innerHTML = '<p>ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    });
}

function renderFilterBar(filterBar, activeMood, onFilterChange) {
  filterBar.innerHTML = '';

  Object.keys(MOOD_LABELS).forEach((moodKey) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = MOOD_LABELS[moodKey];
    btn.dataset.mood = moodKey;
    btn.className = 'filter-btn' + (moodKey === activeMood ? ' filter-btn--active' : '');

    btn.addEventListener('click', () => {
      filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      onFilterChange(moodKey);
    });

    filterBar.appendChild(btn);
  });
}

function renderProductList(productList, products, moodFilter) {
  const filtered = moodFilter === 'all'
    ? products
    : products.filter((p) => p.mood === moodFilter);

  productList.innerHTML = '';

  if (filtered.length === 0) {
    productList.innerHTML = '<p>ไม่พบสินค้าในหมวดนี้</p>';
    return;
  }

  filtered.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'card';

    const orderUrl = 'order.html?item=' + encodeURIComponent(product.name) +
      '&price=' + encodeURIComponent(product.price);

    card.innerHTML = `
      <img class="card__image" src="${product.image}" alt="${product.name}">
      <div class="card__title">${product.name}</div>
      <div class="card__meta">${product.size}</div>
      <div class="price">${Number(product.price).toLocaleString('th-TH')} บาท</div>
      <a class="btn" href="${orderUrl}">สั่งซื้อ</a>
    `;

    productList.appendChild(card);
  });
}

/* ---------------------------------------------------------
   2) order.html — autofill from URL params + submit
   --------------------------------------------------------- */
function initOrderPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const item = urlParams.get('item');
  const price = urlParams.get('price');

  const itemsField = document.getElementById('items');
  const totalField = document.getElementById('total');

  if (item !== null) itemsField.value = item;
  if (price !== null) totalField.value = price;

  const form = document.getElementById('orderForm');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(() => {
        window.location.href = 'thankyou.html';
      })
      .catch((error) => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
  });
}

/* ---------------------------------------------------------
   3) admin.html — fetch CSV, parse manually, render table
   --------------------------------------------------------- */
function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');

  fetch(CSV_URL)
    .then((res) => res.text())
    .then((csvText) => {
      const rows = parseCSV(csvText);
      if (rows.length === 0) return;

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''));

      const colIndex = {
        timestamp: findColumn(header, ['timestamp', 'วันเวลา', 'date']),
        customerName: findColumn(header, ['customername', 'ชื่อลูกค้า', 'name']),
        contact: findColumn(header, ['contact', 'เบอร์โทร', 'line']),
        items: findColumn(header, ['items', 'รายการสินค้า', 'รายการ']),
        total: findColumn(header, ['total', 'จำนวนเงินรวม', 'ยอดรวม']),
        note: findColumn(header, ['note', 'หมายเหตุ'])
      };

      const orders = dataRows.map((row) => ({
        timestamp: colIndex.timestamp >= 0 ? row[colIndex.timestamp] : '',
        customerName: colIndex.customerName >= 0 ? row[colIndex.customerName] : '',
        contact: colIndex.contact >= 0 ? row[colIndex.contact] : '',
        items: colIndex.items >= 0 ? row[colIndex.items] : '',
        total: colIndex.total >= 0 ? row[colIndex.total] : '',
        note: colIndex.note >= 0 ? row[colIndex.note] : ''
      }));

      orders.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
      });

      tbody.innerHTML = '';

      orders.forEach((order) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(order.timestamp)}</td>
          <td>${escapeHtml(order.customerName)}</td>
          <td>${escapeHtml(order.contact)}</td>
          <td>${escapeHtml(order.items)}</td>
          <td>${escapeHtml(order.total)}</td>
          <td>${escapeHtml(order.note)}</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch((error) => {
      console.error(error);
      tbody.innerHTML = '<tr><td colspan="6">ไม่สามารถโหลดข้อมูลออเดอร์ได้</td></tr>';
    });
}

function findColumn(header, candidates) {
  for (const candidate of candidates) {
    const idx = header.indexOf(candidate.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Minimal CSV parser (no external library).
 * Handles quoted fields, commas inside quotes, and escaped quotes ("").
 * Returns an array of rows, each row an array of string cells.
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        // skip, handled by \n
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }

  // last field/row if file doesn't end with newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
