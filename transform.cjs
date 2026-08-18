const fs = require('fs');

const em010 = JSON.parse(fs.readFileSync('database/data/EM010.json', 'utf8'));

// The target structure
const result = {
    requisitos_minimos_iluminacion: {}
};

function mapItemsToAreas(items) {
    if (!items) return [];
    return items.map(item => ({
        area: item.tipo_interior_tarea_actividad,
        Em_lux: item.Em_lux,
        UGRL: item.UGRL,
        Uo: item.Uo,
        Ra: item.Ra,
        requisitos: item.requisitos_especificos
    }));
}

em010.categorias.forEach(cat => {
    const catCode = cat.codigo;
    const catObj = {
        categoria: cat.categoria
    };

    if (cat.items) {
        catObj.areas = mapItemsToAreas(cat.items);
    }

    if (cat.subcategorias) {
        catObj.subcategorias = {};
        cat.subcategorias.forEach(sub => {
            const subCode = sub.codigo;
            catObj.subcategorias[subCode] = {
                nombre: sub.nombre,
                areas: mapItemsToAreas(sub.items)
            };
        });
    }

    result.requisitos_minimos_iluminacion[catCode] = catObj;
});

// Backup original
fs.copyFileSync('database/data/normativa_luminarias_peru.json', 'database/data/normativa_luminarias_peru.backup.json');

// Write new
fs.writeFileSync('database/data/normativa_luminarias_peru.json', JSON.stringify(result, null, 2), 'utf8');
console.log('Transformation complete!');
