/**
 * QR Code Manager Controller
 * Handles Generation via qrcode.js and Persistence via LocalStorage
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const STORAGE_KEY = 'qr_manager_data';
    let qrLibrary = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let currentPreviewQRCode = null;

    // --- DOM Elements ---
    const inputQrText = document.getElementById('qr-text');
    const inputQrLabel = document.getElementById('qr-label');
    const btnGenerate = document.getElementById('generate-qr');
    const btnSave = document.getElementById('save-qr');
    const boxPreview = document.getElementById('preview-box');
    const gridQr = document.getElementById('qr-grid');
    const textLibraryCount = document.getElementById('library-count');

    // --- Core Functions ---

    /**
     * Renders a QR code onto a specified DOM element
     */
    function renderQRCode(element, text, size = 180) {
        element.innerHTML = ''; // clear previous
        return new QRCode(element, {
            text: text,
            width: size,
            height: size,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    /**
     * Updates the main library count text
     */
    function updateCount() {
        textLibraryCount.textContent = `${qrLibrary.length} item${qrLibrary.length !== 1 ? 's' : ''}`;
    }

    /**
     * Saves library state to LocalStorage
     */
    function persistData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(qrLibrary));
        updateCount();
    }

    /**
     * Deletes an item from the library
     */
    window.deleteItem = (id) => {
        qrLibrary = qrLibrary.filter(item => item.id !== id);
        persistData();
        renderGrid();
    };

    /**
     * Downloads the QR code image by extracting the canvas basic64 data
     */
    window.downloadItem = (id) => {
        const item = qrLibrary.find(i => i.id === id);
        if (!item) return;

        // Find the canvas inside the card
        const cardElement = document.querySelector(`[data-card-id="${id}"]`);
        if (!cardElement) return;

        const canvas = cardElement.querySelector('canvas');
        if (!canvas) {
            alert("Image not ready to download.");
            return;
        }

        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `QR_${item.label || 'Code'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    /**
     * Renders the grid of QR Cards
     */
    function renderGrid() {
        gridQr.innerHTML = '';
        if (qrLibrary.length === 0) {
            gridQr.innerHTML = `<p style="color: var(--color-text-muted); grid-column: 1 / -1; text-align: center; padding: 2rem;">Your library is empty. Generate a QR code to start building your collection.</p>`;
            return;
        }

        qrLibrary.forEach(item => {
            // Create Card Container
            const card = document.createElement('div');
            card.className = 'qr-card zoom-in-section';
            card.setAttribute('data-card-id', item.id);
            card.setAttribute('data-testid', `card-qr-${item.id}`);

            // Create Image Container
            const imgContainer = document.createElement('div');
            imgContainer.className = 'qr-card__image';

            // Render actual QR instance inside the image container
            renderQRCode(imgContainer, item.text, 160);

            // Create Content Container
            const contentContainer = document.createElement('div');
            contentContainer.className = 'qr-card__content';

            contentContainer.innerHTML = `
                <div class="qr-card__label" data-testid="label-qr-${item.id}">${item.label || 'Unlabeled Code'}</div>
                <div class="qr-card__data" data-testid="data-qr-${item.id}">${item.text}</div>
                <div class="qr-card__actions">
                    <button class="qr-card__btn qr-card__btn--download" onclick="downloadItem('${item.id}')" data-testid="btn-download-${item.id}">
                        <i class="fa-solid fa-download"></i> Save PNG
                    </button>
                    <button class="qr-card__btn qr-card__btn--delete" onclick="deleteItem('${item.id}')" data-testid="btn-delete-${item.id}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;

            card.appendChild(imgContainer);
            card.appendChild(contentContainer);
            gridQr.appendChild(card);
        });
    }

    // --- Event Listeners ---

    btnGenerate.addEventListener('click', () => {
        const text = inputQrText.value.trim();
        if (!text) {
            alert('Please enter a URL, text, or data to generate a QR Code.');
            inputQrText.focus();
            return;
        }

        // Render preview
        currentPreviewQRCode = renderQRCode(boxPreview, text, 200);

        // Enable save button
        btnSave.removeAttribute('disabled');
        btnSave.classList.remove('btn-secondary'); // Visual hint it's active
    });

    btnSave.addEventListener('click', () => {
        const text = inputQrText.value.trim();
        const label = inputQrLabel.value.trim();

        if (!text) return; // shouldn't happen if generate was pressed

        const newItem = {
            id: Date.now().toString(),
            text: text,
            label: label,
            createdAt: new Date().toISOString()
        };

        // Add to library and save
        qrLibrary.unshift(newItem); // put at top
        persistData();
        renderGrid();

        // Reset Form
        inputQrText.value = '';
        inputQrLabel.value = '';
        boxPreview.innerHTML = `
            <div class="generate-preview__placeholder">
                <i class="fa-solid fa-qrcode"></i>
                <p>Code Saved to Library</p>
            </div>
        `;
        btnSave.setAttribute('disabled', 'true');
        btnSave.classList.add('btn-secondary');
    });

    // Initialize View
    updateCount();
    renderGrid();
});
