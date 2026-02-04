document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    const map = L.map('map').setView([55.7558, 37.6173], 11);

    // 2. Add OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 3. Define Icons
    const icons = {
        active: new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }),
        planned: new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    };

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
        // We need to clear radiusGroups explicitly if we are re-rendering entirely
        Object.values(radiusGroups).forEach(group => group.clearLayers());

        appData.features.forEach(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;

            // Validate coords
            if (!coords || coords.length < 2) return;

            // Filter logic
            if (filterStatus !== 'all' && props.status !== filterStatus) {
                return;
            }

            // Create Marker
            const marker = L.marker([coords[0], coords[1]], {
                icon: icons[props.status] || icons.active,
                id: props.id
            });

            // Bind Popup
            const yandexLink = `https://yandex.ru/maps/?text=${coords[0]},${coords[1]}`;

            const popupContent = `
                <div class="popup-content">
                    <h3>${props.name}</h3>
                    <p><strong>Статус:</strong> ${props.status === 'active' ? 'Активен' : 'Планируется'}</p>
                    <p><strong>Адрес:</strong> ${props.address || '-'}</p>
                    <hr>
                    <p><strong>Менеджер:</strong> ${props.manager || '-'}</p>
                    <p><strong>Телефон:</strong> ${props.phone || '-'}</p>
                    <p><strong>Бюджет:</strong> ${props.budget || '-'}</p>
                    ${props.status === 'active' ? `<p><strong>Прогресс:</strong> ${props.progress || 0}%</p>` : ''}
                    <p><em>${props.description || ''}</em></p>
                    <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
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
                <h3>${props.name}</h3>
                <span class="status ${props.status}">${props.status === 'active' ? 'Активен' : 'Планируется'}</span>
                <p>${props.address || 'Нет адреса'}</p>
                <p>Бюджет: ${props.budget || '-'}</p>
            `;

            listItem.addEventListener('click', () => {
                map.flyTo(marker.getLatLng(), 15);
                marker.openPopup();
                selectObject(props.id);
            });

            objectListElement.appendChild(listItem);
        });

        redrawCircles();
    }

    // Function to handle object selection
    function selectObject(id) {
        selectedMarkerId = id;

        document.querySelectorAll('.object-item').forEach(item => {
            // Loose comparison for IDs that might be strings
            if (item.dataset.id == id) {
                item.style.borderColor = 'var(--accent-color)';
                item.style.boxShadow = '0 0 5px rgba(52, 152, 219, 0.5)';
                item.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Auto scroll to item
            } else {
                item.style.borderColor = 'var(--border-color)';
                item.style.boxShadow = 'none';
            }
        });

        redrawCircles();
    }

    // Radius Helper Functions
    function redrawCircles() {
        Object.values(radiusGroups).forEach(group => group.clearLayers());

        if (activeRadii.size === 0) return;

        Object.values(markers).forEach(marker => {
            const latLng = marker.getLatLng();
            const isSelected = (marker.options.id === selectedMarkerId);

            activeRadii.forEach(radius => {
                let circleOptions;

                if (isSelected) {
                    circleOptions = {
                        radius: radius,
                        color: '#3498db',
                        weight: 2,
                        opacity: 0.8,
                        fillColor: '#3498db',
                        fillOpacity: 0.2,
                        interactive: false
                    };
                } else {
                    circleOptions = {
                        radius: radius,
                        color: '#3498db',
                        weight: 1,
                        opacity: 0.4,
                        className: 'hatched-fill',
                        fillOpacity: 0.3,
                        interactive: false
                    };
                }

                if (!radiusGroups[radius]) {
                    radiusGroups[radius] = L.layerGroup().addTo(map);
                }

                const circle = L.circle(latLng, circleOptions).addTo(radiusGroups[radius]);

                if (isSelected) {
                    circle.bringToFront();
                }
            });
        });
    }

    // Initial Render
    renderObjects();

    // Event Listeners
    filterElement.addEventListener('change', (e) => {
        renderObjects(e.target.value);
    });

    const radiusCheckboxes = document.querySelectorAll('.radius-controls input');

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
                            address: row.Address || "",
                            manager: row.Manager || "",
                            phone: row.Phone || "",
                            budget: row.Budget || "",
                            progress: row.Progress || 0
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
