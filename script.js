const MEMBERS = ['Amira Najwa Fitri', 'Hopizatul Aini', 'Nurul Hidayah', 'Naluri Najwa'];
const STORAGE_KEY = 'family_savings_data';

const app = {
    data: {
        balances: {},
        transactions: [],
        photos: {}, // Stores base64 images { "MemberName": "data:image..." }
        photoPositions: {} // { "MemberName": { x: 50, y: 50 } }
    },

    init: function () {
        this.loadData();
        this.renderMembersDropdown();
        this.initPhotoUpload();
        this.initModalListeners();
        this.updateUI();
    },

    loadData: function () {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            this.data = JSON.parse(stored);
            if (!this.data.photos) this.data.photos = {}; // Ensure photo obj exists if migraing
            if (!this.data.photoPositions) this.data.photoPositions = {};

            // Ensure transactions have IDs (migration fix)
            this.data.transactions = this.data.transactions.map(t => {
                if (!t.id) t.id = Date.now() + Math.random(); // Backfill ID
                return t;
            });
        } else {
            // Initialize balances for all members if new
            MEMBERS.forEach(member => {
                this.data.balances[member] = 0;
            });
            this.data.photos = {};
            this.data.photoPositions = {};
        }
    },

    saveData: function () {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('Memori Browser Penuh! Tidak bisa menyimpan foto baru. Coba hapus beberapa data atau gunakan foto yang lebih kecil.');
            } else {
                alert('Gagal menyimpan data: ' + e.message);
            }
            console.error(e);
        }
    },

    formatCurrency: function (amount) {
        // User requested "10.000" format (dots). 
        // Using id-ID locale gives "Rp 10.000".
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    renderMembersDropdown: function () {
        const select = document.getElementById('member-select');
        select.innerHTML = '<option value="" disabled selected>-- Pilih Siapa --</option>'; // Reset
        MEMBERS.forEach(member => {
            const option = document.createElement('option');
            option.value = member;
            option.textContent = member;
            select.appendChild(option);
        });
    },

    initPhotoUpload: function () {
        const input = document.getElementById('photo-input');
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && this.currentPhotoMember) {
                // Show loading indicator (optional, but good for UX)
                // Compress/Resize before saving
                // Optimization: Resize to 200x200 (enough for avatar) and 0.6 quality
                this.resizeImage(file, 200, 200, (resizedBase64) => {
                    this.data.photos[this.currentPhotoMember] = resizedBase64;
                    // Reset position when new photo uploaded
                    this.data.photoPositions[this.currentPhotoMember] = { x: 50, y: 50 };
                    this.saveData();
                    this.updateUI();
                    alert('Foto berhasil diupdate!');
                });
            }
            input.value = ''; // Reset
        });
    },

    resizeImage: function (file, maxWidth, maxHeight, callback) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Get compressed base64 (JPEG 0.6 quality)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                callback(dataUrl);
            };
            img.onerror = () => {
                alert('Gagal memproses gambar. File mungkin rusak.');
            };
        };
        reader.onerror = () => {
            alert('Gagal membaca file.');
        };
    },

    initModalListeners: function () {
        const posX = document.getElementById('pos-x');
        const posY = document.getElementById('pos-y');
        const preview = document.getElementById('preview-img');

        const updatePreview = () => {
            preview.style.objectPosition = `${posX.value}% ${posY.value}%`;
        };

        posX.addEventListener('input', updatePreview);
        posY.addEventListener('input', updatePreview);
    },

    triggerPhotoUpload: function (member) {
        this.currentPhotoMember = member; // Store who we are uploading for
        document.getElementById('photo-input').click();
    },

    openPositionModal: function (member) {
        if (!this.data.photos[member]) {
            alert('Silakan upload foto terlebih dahulu sebelum mengatur posisi.');
            return;
        }

        this.currentPhotoMember = member; // Target user
        const pos = this.data.photoPositions[member] || { x: 50, y: 50 };
        const modal = document.getElementById('position-modal');
        const preview = document.getElementById('preview-img');
        const rangeX = document.getElementById('pos-x');
        const rangeY = document.getElementById('pos-y');

        // Setup Init State
        preview.src = this.data.photos[member];
        rangeX.value = pos.x;
        rangeY.value = pos.y;
        preview.style.objectPosition = `${pos.x}% ${pos.y}%`;

        modal.classList.add('active');
    },

    closePositionModal: function () {
        document.getElementById('position-modal').classList.remove('active');
    },

    savePosition: function () {
        const member = this.currentPhotoMember;
        const x = document.getElementById('pos-x').value;
        const y = document.getElementById('pos-y').value;

        this.data.photoPositions[member] = { x: parseInt(x), y: parseInt(y) };
        this.saveData();
        this.updateUI();
        this.closePositionModal();
    },

    updateUI: function () {
        // 1. Update Global Total
        const total = Object.values(this.data.balances).reduce((a, b) => a + b, 0);
        document.getElementById('global-total').textContent = this.formatCurrency(total);

        // 2. Update Member Cards
        const container = document.getElementById('members-container');
        container.innerHTML = '';

        MEMBERS.forEach(member => {
            const balance = this.data.balances[member] || 0;
            const photoSrc = this.data.photos[member];
            const pos = this.data.photoPositions[member] || { x: 50, y: 50 };

            const card = document.createElement('div');
            card.className = 'member-card';

            // Photo Logic
            let photoHtml = '';
            if (photoSrc) {
                photoHtml = `<img src="${photoSrc}" alt="${member}" style="object-position: ${pos.x}% ${pos.y}%">`;
            } else {
                photoHtml = `<div class="member-photo-placeholder">👤</div>`;
            }

            card.innerHTML = `
                <div class="member-photo-wrapper">
                    ${photoHtml}
                    <div class="member-photo-overlay">
                        <button class="btn-overlay" onclick="app.triggerPhotoUpload('${member}')">Ganti</button>
                        <button class="btn-overlay" onclick="app.openPositionModal('${member}')">Atur</button>
                    </div>
                </div>
                <span class="member-name">${member}</span>
                <span class="member-balance">${this.formatCurrency(balance)}</span>
            `;
            container.appendChild(card);
        });

        // 3. Update History Table
        const tbody = document.getElementById('history-table-body');
        const emptyMsg = document.getElementById('empty-history-msg');
        tbody.innerHTML = '';

        if (!this.data.transactions || this.data.transactions.length === 0) {
            emptyMsg.style.display = 'block';
        } else {
            emptyMsg.style.display = 'none';
            // Show new transactions first
            const recentTransactions = [...this.data.transactions].reverse();

            recentTransactions.forEach(t => {
                const row = document.createElement('tr');
                const typeClass = t.type === 'deposit' ? 'type-nabung' : 'type-ambil';
                const typeLabel = t.type === 'deposit' ? 'Nabung' : 'Ambil';

                row.innerHTML = `
                    <td>${t.date}</td>
                    <td>${t.member}</td>
                    <td><span class="${typeClass}">${typeLabel}</span></td>
                    <td>${this.formatCurrency(t.amount)}</td>
                    <td>
                        <button class="btn-delete" onclick="app.deleteTransaction(${t.id})">Hapus</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    },

    handleTransaction: function (type) {
        const memberSelect = document.getElementById('member-select');
        const amountInput = document.getElementById('amount-input');

        const member = memberSelect.value;
        const amount = parseInt(amountInput.value);

        // Validation
        if (!member) {
            alert('Silakan pilih nama anggota terlebih dahulu.');
            return;
        }

        if (!amount || amount <= 0) {
            alert('Masukkan jumlah uang yang valid.');
            return;
        }

        const currentBalance = this.data.balances[member] || 0;

        if (type === 'withdraw' && amount > currentBalance) {
            alert(`Saldo tidak cukup! Sisa saldo ${member}: ${this.formatCurrency(currentBalance)}`);
            return;
        }

        // Process Transaction
        if (type === 'deposit') {
            this.data.balances[member] = currentBalance + amount;
        } else {
            this.data.balances[member] = currentBalance - amount;
        }

        // Add to history
        this.data.transactions.push({
            id: Date.now(), // Unique ID
            date: new Date().toLocaleString('id-ID'),
            member: member,
            type: type,
            amount: amount
        });

        // Save and Update UI
        this.saveData();
        this.updateUI();

        // Reset form
        amountInput.value = '';
        // Optional: Keep member selected or reset? User didn't specify. Keeping it selected is usually better UX for repeated entry.

        alert('Transaksi berhasil!');
    },

    deleteTransaction: function (id) {
        if (!confirm('Yakin ingin menghapus transaksi ini? Saldo akan dikembalikan.')) return;

        const txIndex = this.data.transactions.findIndex(t => t.id === id);
        if (txIndex === -1) return;

        const tx = this.data.transactions[txIndex];

        // Revert Balance
        const currentBalance = this.data.balances[tx.member] || 0;
        if (tx.type === 'deposit') {
            // If it was deposit, we remove money
            this.data.balances[tx.member] = currentBalance - tx.amount;
        } else {
            // If it was withdraw, we add money back
            this.data.balances[tx.member] = currentBalance + tx.amount;
        }

        // Remove from array
        this.data.transactions.splice(txIndex, 1);

        this.saveData();
        this.updateUI();
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
