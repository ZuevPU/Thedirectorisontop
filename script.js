// Убедитесь, что graphData загружается из data.js
// Здесь мы предполагаем, что `graphData` уже доступна глобально после подключения data.js

// --- 1. Основные настройки и инициализация SVG ---
const width = document.getElementById('graph-container').offsetWidth;
const height = document.getElementById('graph-container').offsetHeight;

// Создаем SVG элемент внутри контейнера
const svg = d3.select("#graph-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// Создаем группу 'g' для всех элементов графа, чтобы применять к ней масштабирование и панорамирование
const g = svg.append("g");

// --- 2. Настройка симуляции сил D3.js ---
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(100).strength(0.7)) // Сила связей
    .force("charge", d3.forceManyBody().strength(-300)) // Сила отталкивания
    .force("center", d3.forceCenter(width / 2, height / 2)); // Центрирование графа

// --- 3. Инициализация элементов графа (связи и узлы) ---
let link = g.append("g")
    .attr("class", "links")
    .selectAll("line");

let node = g.append("g")
    .attr("class", "nodes")
    .selectAll(".node");

// --- Переменная для хранения ссылки на текущий раскрытый узел ---
let currentlyExpandedNode = null;

// --- 4. Функции для перетаскивания узлов ---
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; // РАСКОММЕНТИРОВАНО: Узел будет двигаться по вертикали
    d.fy = null; // РАСКОММЕНТИРОВАНО: Узел будет двигаться по вертикали
}

// --- Вспомогательная функция для обновления внешнего вида узла (текст, размер прямоугольника) ---
function updateNodeAppearance(gNodeSelection, nodeData) {
    const rectElement = gNodeSelection.select("rect");
    const textElement = gNodeSelection.select(".node-main-text"); // Основной текст

    const originalText = nodeData.text || nodeData.id;
    const textLengthThreshold = 12; // Порог для обрезки текста

    // Определяем, какой текст показывать
    if (nodeData.type === 'word' && originalText.length > textLengthThreshold && !nodeData.isFullTextVisible) {
        textElement.text(originalText.substring(0, textLengthThreshold) + "..."); // Показываем обрезанный
    } else {
        textElement.text(originalText); // Показываем полный текст
    }

    // Измеряем ширину и высоту основного текста (после его установки)
    const textBBox = textElement.node().getBBox();
    const padding = nodeData.type === 'cluster' ? 20 : 15; // Отступы для кластеров и слов
    const minWidth = nodeData.type === 'cluster' ? 120 : 60; // Минимальная ширина
    const minHeight = nodeData.type === 'cluster' ? 50 : 30; // Минимальная высота

    const calculatedWidth = Math.max(minWidth, textBBox.width + padding * 2);
    const calculatedHeight = Math.max(minHeight, textBBox.height + padding * 2);

    rectElement
        .attr("width", calculatedWidth)
        .attr("height", calculatedHeight)
        .attr("x", -calculatedWidth / 2) // Центрируем по X
        .attr("y", -calculatedHeight / 2); // Центрируем по Y

    // Позиционируем основной текст
    textElement.attr("x", 0); // Текст всегда по центру, так как нет кнопки
}


// --- 5. Обновление графа (для фильтрации и первого рендеринга) ---
function updateGraph(nodesData, linksData) {
    // Важно: Сначала обновить узлы симуляции, чтобы forceLink мог найти объекты по ID
    simulation.nodes(nodesData);
    simulation.force("link").links(linksData);

    // Обновляем связи
    link = link.data(linksData, d => `${d.source.id}-${d.target.id}`)
        .join(
            enter => enter.append("line").attr("class", "link"),
            update => update,
            exit => exit.remove()
        );

    // Обновляем узлы
    node = node.data(nodesData, d => d.id)
        .join(
            enter => {
                const gNode = enter.append("g")
                    .attr("class", d => `node ${d.type}`)
                    .call(d3.drag()
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended))
                    .on("click", handleNodeClick); // Добавляем обработчик клика на весь узел

                // Создаем прямоугольник для всех узлов
                gNode.append("rect")
                    .attr("rx", 30) // Радиус закругления углов (пилюля)
                    .attr("ry", 30); // Радиус закругления углов

                // Добавляем текстовый элемент (основной текст узла)
                gNode.append("text")
                    .attr("class", "node-main-text") // Добавляем класс для основного текста
                    .attr("font-size", d => d.type === 'cluster' ? "15px" : "10px")
                    .attr("pointer-events", "none") // Текст не перехватывает события мыши
                    .attr("text-anchor", "middle") // Центрирование текста по горизонтали
                    .attr("dominant-baseline", "central"); // Центрирование текста по вертикали

                return gNode;
            },
            update => {
                // Обновляем существующие элементы
                update.select("rect")
                    .attr("rx", 30)
                    .attr("ry", 30);
                update.select(".node-main-text") // Обновляем основной текст
                    .attr("font-size", d => d.type === 'cluster' ? "15px" : "10px");
                return update;
            },
            exit => exit.remove()
        );

    // После того как узлы добавлены и текст установлен, измеряем текст для адаптивного размера
    node.each(function(d) {
        // Вызываем вспомогательную функцию для каждого узла
        updateNodeAppearance(d3.select(this), d);
    });

    // Применяем обработчики наведения после создания/обновления узлов
    node.on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut);

    // Перезапускаем симуляцию
    simulation.alpha(1).restart();
}

// --- Обработчик клика по узлу ---
function handleNodeClick(event, d) {
    if (d.type === 'word') { // Только для узлов-слов
        // Если кликнули на уже раскрытый узел, схлопываем его
        if (currentlyExpandedNode === d) {
            d.isFullTextVisible = false;
            currentlyExpandedNode = null;
        } else {
            // Если есть другой раскрытый узел, схлопываем его
            if (currentlyExpandedNode && currentlyExpandedNode.type === 'word') {
                currentlyExpandedNode.isFullTextVisible = false;
                // Обновляем внешний вид предыдущего узла
                // Важно: d3.select(currentlyExpandedNode.gNodeElement) должен быть валидным
                if (currentlyExpandedNode.gNodeElement) { // Проверяем, что элемент существует
                    updateNodeAppearance(d3.select(currentlyExpandedNode.gNodeElement), currentlyExpandedNode);
                }
            }
            // Раскрываем текущий узел
            d.isFullTextVisible = true;
            currentlyExpandedNode = d;
        }

        // Сохраняем ссылку на DOM-элемент узла для последующего обновления
        d.gNodeElement = this;

        // Обновляем внешний вид текущего узла
        updateNodeAppearance(d3.select(this), d);

        // Не нужно перезапускать симуляцию для изменения размера одного узла.
        // D3 автоматически учтет изменение размеров на следующем тике.
    }
}


// --- 6. Обработчики событий мыши (hover) ---
function handleMouseOver(event, d) {
    // Подсвечиваем текущий узел (прямоугольник)
    d3.select(event.currentTarget).select("rect")
        .style("stroke", "orange")
        .style("stroke-width", "3px");

    // Определяем связанные узлы
    const connectedNodeIds = new Set();
    connectedNodeIds.add(d.id); // Добавляем текущий узел

    // Проходим по ВСЕМ связям в graphData.links, чтобы найти связанных
    graphData.links.forEach(l => {
        // Убедимся, что l.source и l.target уже являются объектами узлов после simulation.nodes()
        if (l.source.id === d.id) connectedNodeIds.add(l.target.id);
        if (l.target.id === d.id) connectedNodeIds.add(l.source.id);
    });

    // Подсвечиваем связанные связи
    link.style("stroke-opacity", linkD => (connectedNodeIds.has(linkD.source.id) && connectedNodeIds.has(linkD.target.id)) ? 1 : 0.1)
        .style("stroke", linkD => (connectedNodeIds.has(linkD.source.id) && connectedNodeIds.has(linkD.target.id)) ? "#ff8c00" : "#999");

    // Подсвечиваем связанные узлы
    node.style("opacity", nodeD => connectedNodeIds.has(nodeD.id) ? 1 : 0.2);
}

function handleMouseOut(event, d) {
    // Возвращаем исходные стили для прямоугольника
    d3.select(event.currentTarget).select("rect")
        .style("stroke", d.type === 'cluster' ? "#005bb5" : "#2eaf4d") // ПРАВИЛЬНЫЕ ЦВЕТА РАМОК
        .style("stroke-width", "1.5px");
    link.style("stroke-opacity", 0.6).style("stroke", "#b0b0b5"); // Возвращаем исходный серый для связей
    node.style("opacity", 1);
}

// --- 7. Масштабирование и панорамирование ---
const zoom = d3.zoom()
    .scaleExtent([0.1, 4]) // Диапазон масштабирования от 10% до 400%
    .on("zoom", (event) => {
        g.attr("transform", event.transform); // Применяем трансформации к группе 'g'
    });

svg.call(zoom); // Применяем зум к SVG

// --- 8. Обновление позиций на каждом тике симуляции ---
simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    // Узлы перемещаются целиком, а внутри группы уже отрисовываются rect и text
    node
        .attr("transform", d => `translate(${d.x},${d.y})`);
});

// --- 9. Логика фильтрации по кластерам ---
const filterContainer = d3.select("#filters"); // Убедитесь, что этот #filters div существует в HTML

// Получаем список уникальных кластеров из данных
const uniqueClusters = Array.from(new Set(
    graphData.nodes.filter(n => n.type === 'cluster').map(n => n.id)
));

const clusterCheckboxes = {}; // Хранилище для чекбоксов

uniqueClusters.forEach(clusterName => {
    const div = filterContainer.append("div")
        .style("display", "inline-flex") // Используем flexbox для выравнивания
        .style("align-items", "center")
        .style("margin-bottom", "12px") // Отступ между элементами
        .attr("class", "filter-item"); // Добавляем класс для стилизации

    const checkboxId = `filter-${clusterName.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`; // Безопасный ID
    const checkbox = div.append("input")
        .attr("type", "checkbox")
        .attr("id", checkboxId)
        .property("checked", true); // По умолчанию все включены
    clusterCheckboxes[clusterName] = checkbox;

    div.append("label")
        .attr("for", checkboxId)
        .text(clusterName);

    checkbox.on("change", applyFilters);
});

function applyFilters() {
    const activeClusters = uniqueClusters.filter(c => clusterCheckboxes[c].property("checked"));

    const filteredNodes = new Set();
    const filteredLinks = [];

    // Добавляем активные кластеры
    graphData.nodes.filter(n => n.type === 'cluster' && activeClusters.includes(n.id))
        .forEach(n => filteredNodes.add(n));

    // Добавляем слова, связанные с активными кластерами, и соответствующие связи
    graphData.links.forEach(l => {
        const sourceNode = l.source; // D3 уже разрешил эти ссылки на объекты
        const targetNode = l.target;

        const sourceIsActiveCluster = sourceNode.type === 'cluster' && activeClusters.includes(sourceNode.id);
        const targetIsActiveCluster = targetNode.type === 'cluster' && activeClusters.includes(targetNode.id);

        const sourceIsWord = sourceNode.type === 'word';
        const targetIsWord = targetNode.type === 'word';

        // Связь между активным кластером и словом
        if ((sourceIsActiveCluster && targetIsWord) || (targetIsActiveCluster && sourceIsWord)) {
            // Убеждаемся, что связь ведёт к активному кластеру
            if ((sourceIsWord && activeClusters.includes(targetNode.id)) || (targetIsWord && activeClusters.includes(sourceNode.id))) {
                filteredLinks.push(l);
                filteredNodes.add(sourceNode);
                filteredNodes.add(targetNode);
            }
        }
        // Связь между двумя активными кластерами
        else if (sourceIsActiveCluster && targetIsActiveCluster) {
            filteredLinks.push(l);
            filteredNodes.add(sourceNode);
            filteredNodes.add(targetNode);
        }
    });

    const finalNodes = Array.from(filteredNodes);
    updateGraph(finalNodes, filteredLinks);
}


// --- 10. Запускаем первый рендеринг графа ---
// Добавляем флаг isFullTextVisible для каждого узла-слова
graphData.nodes.forEach(d => {
    if (d.type === 'word') {
        d.isFullTextVisible = false; // По умолчанию текст скрыт
    }
});
updateGraph(graphData.nodes, graphData.links);

// Функция для центрирования графа по кнопке
function resetView() {
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(0, 0).scale(1)
    );
}

// --- Функции для управления модальным окном ---
const helpModal = document.getElementById('helpModal');

function openHelpModal() {
    helpModal.classList.add('show');
}

function closeHelpModal() {
    helpModal.classList.remove('show');
}

// Закрытие модального окна по клику вне его содержимого
window.onclick = function(event) {
    if (event.target == helpModal) {
        closeHelpModal();
    }
}