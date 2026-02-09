document.addEventListener('DOMContentLoaded', () => {
    // Helper function to convert Excel serial date to readable date string
    function excelDateToString(excelDate) {
        if (!excelDate) return '';
        // If it's already a string that looks like a date, return as-is
        if (typeof excelDate === 'string' && excelDate.includes('.')) return excelDate;
        // If it's a number (Excel serial date)
        if (typeof excelDate === 'number') {
            const date = new Date((excelDate - 25569) * 86400 * 1000);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        }
        return String(excelDate);
    }

    // 1. Initialize Map
    const map = L.map('map').setView([55.7558, 37.6173], 11);

    // 2. Add OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 3. Create custom label marker
    function createLabelMarker(name, status) {
        const shortName = name.length > 20 ? name.substring(0, 18) + '...' : name;
        const bgColor = status === 'active' ? '#1a2e1a' : '#6b7280';

        return L.divIcon({
            className: 'custom-label-marker',
            html: `<div class="marker-label" style="background-color: ${bgColor};">
                <span class="marker-name">${shortName}</span>
                <span class="marker-icon">🏗️</span>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 15],
            popupAnchor: [0, -15]
        });
    }

    // Store markers to access them later
    const markers = {};
    const objectListElement = document.getElementById('object-list');
    const filterElement = document.getElementById('status-filter');

    // Radius Layers Management
    const radiusGroups = {};
    const activeRadii = new Set();
    let selectedMarkerId = null;

    // --- DATA MANAGEMENT START ---

    // Check LocalStorage on init
    let appData = constructionData; // Default from data.js
    const savedData = localStorage.getItem('constructionValues');

    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed && parsed.features) {
                appData = parsed;
                console.log('Loaded data from LocalStorage');
            }
        } catch (e) {
            console.error('Error parsing LocalStorage data', e);
        }
    }

    // Function to save current state
    function saveData() {
        localStorage.setItem('constructionValues', JSON.stringify(appData));
    }

    // --- DATA MANAGEMENT END ---

    // 4. Render Objects
    function renderObjects(filterStatus = 'all') {
        objectListElement.innerHTML = '';

        // Remove existing markers
        Object.values(markers).forEach(marker => map.removeLayer(marker));
        for (const key in markers) delete markers[key];

        // Clear circles
        Object.values(radiusGroups).forEach(group => group.clearLayers());

        let count = 0;

        appData.features.forEach(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;

            // Validate coords
            if (!coords || coords.length < 2) return;

            // Filter logic
            if (filterStatus !== 'all' && props.status !== filterStatus) {
                return;
            }

            // Create Marker with custom label
            const marker = L.marker([coords[0], coords[1]], {
                icon: createLabelMarker(props.name, props.status),
                id: props.id
            });

            // Bind Popup
            const yandexLink = `https://yandex.ru/maps/?text=${coords[0]},${coords[1]}`;

            const popupContent = `
                <div class="popup-content">
                    <h3>${props.name}</h3>
                    <p><strong>Статус:</strong> ${props.status === 'active' ? 'Активен' : 'Планируется'}</p>
                    <p><strong>Локация:</strong> ${props.location || '-'}</p>
                    <p><strong>Менеджер:</strong> ${props.manager || '-'}</p>
                    <p><strong>Генподрядчик:</strong> ${props.generalContractor || '-'}</p>
                    <p><strong>Закупка:</strong> ${props.procurementLink ? `<a href="${props.procurementLink}" target="_blank">${props.procurementName || 'Ссылка'}</a>` : (props.procurementName || '-')}</p>
                    <p><strong>Срок действия закупки до:</strong> ${props.procurementValidity || '-'}</p>
                    <p><strong>Ближайшая точка снабжения:</strong> ${props.nearestSupplyPoints || '-'}</p>
                    <p><strong>Описание:</strong> ${props.description || '-'}</p>
                    <a href="${yandexLink}" target="_blank" style="color: #e74c3c; text-decoration: none;">📍 Открыть в Яндекс.Картах</a>
                </div>
            `;
            marker.bindPopup(popupContent);

            marker.on('click', () => {
                selectObject(props.id);
            });

            marker.addTo(map);
            markers[props.id] = marker;

            // Add to Sidebar
            const listItem = document.createElement('div');
            listItem.className = 'object-item';
            listItem.dataset.id = props.id;

            listItem.innerHTML = `
                <div class="object-info">
                    <div class="object-header">
                        <span class="object-name">${props.name}</span>
                        <span class="status-indicator ${props.status}"></span>
                    </div>
                    <div class="object-location">${props.location || 'Нет локации'}</div>
                    <div class="object-tags">${props.generalContractor || '-'}</div>
                </div>
            `;

            count++;

            listItem.addEventListener('click', () => {
                map.flyTo(marker.getLatLng(), 12);
                marker.openPopup();
                selectObject(props.id);
            });

            objectListElement.appendChild(listItem);
        });

        // Auto-center map on points if there are any
        if (Object.keys(markers).length > 0) {
            const markerLatLngs = Object.values(markers).map(m => m.getLatLng());
            const bounds = L.latLngBounds(markerLatLngs);
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Update results count
        const resultsCountEl = document.getElementById('results-count');
        if (resultsCountEl) {
            resultsCountEl.textContent = `${count} объектов`;
        }

        redrawCircles();
    }

    // Function to handle object selection
    function selectObject(id) {
        selectedMarkerId = id;

        document.querySelectorAll('.object-item').forEach(item => {
            if (item.dataset.id == id) {
                item.classList.add('selected');
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                item.classList.remove('selected');
            }
        });

        redrawCircles();
    }

    // Radius Helper Functions
    function redrawCircles() {
        Object.values(radiusGroups).forEach(group => group.clearLayers());

        if (activeRadii.size === 0) return;
        if (!selectedMarkerId) return;

        const selectedMarker = markers[selectedMarkerId];
        if (!selectedMarker) return;

        const latLng = selectedMarker.getLatLng();

        activeRadii.forEach(radius => {
            const circleOptions = {
                radius: radius,
                color: '#3498db',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3498db',
                fillOpacity: 0.2,
                interactive: false
            };

            if (!radiusGroups[radius]) {
                radiusGroups[radius] = L.layerGroup().addTo(map);
            }

            L.circle(latLng, circleOptions).addTo(radiusGroups[radius]);
        });
    }

    // Initial Render
    renderObjects();

    // Event Listeners
    filterElement.addEventListener('change', (e) => {
        renderObjects(e.target.value);
    });

    const radiusCheckboxes = document.querySelectorAll('.radius-options input');

    radiusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const radius = parseInt(e.target.value);

            if (e.target.checked) {
                activeRadii.add(radius);
                if (!radiusGroups[radius]) {
                    radiusGroups[radius] = L.layerGroup().addTo(map);
                } else {
                    map.addLayer(radiusGroups[radius]);
                }
            } else {
                activeRadii.delete(radius);
                if (radiusGroups[radius]) {
                    map.removeLayer(radiusGroups[radius]);
                }
            }
            redrawCircles();
        });
    });

    // --- BUTTON HANDLERS ---

    // 1. Import Excel
    const importBtn = document.getElementById('import-btn');
    const excelInput = document.getElementById('excel-input');
    const importStatus = document.getElementById('import-status');

    importBtn.addEventListener('click', () => {
        excelInput.click();
    });

    excelInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Assume data is in the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON
            const json = XLSX.utils.sheet_to_json(worksheet);

            if (json.length === 0) {
                importStatus.textContent = 'Файл пуст или некорректен';
                return;
            }

            // Convert to GeoJSON Features
            let addedCount = 0;
            json.forEach(row => {
                if (row.Lat && row.Lng) { // Valid rows only
                    // Generate ID logic (max + 1)
                    const maxId = appData.features.reduce((max, f) => Math.max(max, parseInt(f.properties.id) || 0), 0);

                    const newFeature = {
                        type: "Feature",
                        properties: {
                            id: maxId + 1 + addedCount, // Ensure distinct IDs
                            name: row.Name || "Новый объект",
                            status: row.Status || "planned",
                            description: row.Description || "",
                            location: row.Location || "",
                            manager: row.Manager || "",
                            procurementName: row["Procurement name"] || "",
                            procurementLink: row["Procurement link"] || "",
                            procurementValidity: excelDateToString(row["Procurement validity period"]),
                            generalContractor: row["General contractor"] || "",
                            nearestSupplyPoints: row["Nearest supply points"] || ""
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [parseFloat(row.Lat), parseFloat(row.Lng)]
                        }
                    };
                    appData.features.push(newFeature);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                saveData(); // Save to LocalStorage
                renderObjects(filterElement.value);
                importStatus.textContent = `Добавлено: ${addedCount} объектов`;
                importStatus.style.color = 'green';
            } else {
                importStatus.textContent = 'Не найдено строк с Lat/Lng';
                importStatus.style.color = 'red';
            }

            // Reset input
            excelInput.value = '';
        };
        reader.readAsArrayBuffer(file);
    });

    // 2. Export Data (Download data.js)
    const exportBtn = document.getElementById('export-btn');
    exportBtn.addEventListener('click', () => {
        const jsonContent = JSON.stringify(appData, null, 2);
        const fileContent = `const constructionData = ${jsonContent};`;

        const blob = new Blob([fileContent], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // 3. Reset Data
    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', () => {
        if (confirm('Вы уверены? Это удалит все добавленные объекты и вернет исходные данные.')) {
            localStorage.removeItem('constructionValues');
            location.reload();
        }
    });

});
