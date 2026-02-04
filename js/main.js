document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    // Coordinates for Moscow center as default
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

    // 4. Load Data and Create Markers
    function renderObjects(filterStatus = 'all') {
        // Clear existing list and markers (if reloading)
        objectListElement.innerHTML = '';

        // In a real app we might want to group markers by layer, but for now we interact with them directly
        // Note: For simple filtering we can just show/hide. 
        // But here we'll re-render the list and markers.

        // Remove existing markers from map
        Object.values(markers).forEach(marker => map.removeLayer(marker));

        constructionData.features.forEach(feature => {
            const props = feature.properties;

            // Filter logic
            if (filterStatus !== 'all' && props.status !== filterStatus) {
                return;
            }

            // Create Marker
            const marker = L.marker([feature.geometry.coordinates[0], feature.geometry.coordinates[1]], {
                icon: icons[props.status] || icons.active
            });

            // Bind Popup
            const popupContent = `
                <div class="popup-content">
                    <h3>${props.name}</h3>
                    <p><strong>Статус:</strong> ${props.status === 'active' ? 'Активен' : 'Планируется'}</p>
                    <p><strong>Адрес:</strong> ${props.address}</p>
                    <p><strong>Менеджер:</strong> ${props.manager}</p>
                    <p><strong>Телефон:</strong> ${props.phone}</p>
                    ${props.status === 'active' ? `<p><strong>Прогресс:</strong> ${props.progress}%</p>` : ''}
                    <p><em>${props.description}</em></p>
                </div>
            `;
            marker.bindPopup(popupContent);

            // Add to map
            marker.addTo(map);
            markers[props.id] = marker;

            // Add to Sidebar List
            const listItem = document.createElement('div');
            listItem.className = 'object-item';
            listItem.innerHTML = `
                <h3>${props.name}</h3>
                <span class="status ${props.status}">${props.status === 'active' ? 'Активен' : 'Планируется'}</span>
                <p>${props.address}</p>
                <p>Бюджет: ${props.budget}</p>
            `;

            // Click event for list item
            listItem.addEventListener('click', () => {
                map.flyTo(marker.getLatLng(), 15);
                marker.openPopup();

                // Highlight item logic could go here
                document.querySelectorAll('.object-item').forEach(i => i.style.borderColor = 'var(--border-color)');
                listItem.style.borderColor = 'var(--accent-color)';
            });

            objectListElement.appendChild(listItem);
        });
    }

    // Initial Render
    renderObjects();

    // Filter Change Event
    filterElement.addEventListener('change', (e) => {
        renderObjects(e.target.value);
    });
});
