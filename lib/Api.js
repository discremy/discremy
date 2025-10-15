const express = require('express');
const { readdirSync, statSync, readFileSync } = require('fs');
const { join, relative } = require('path');

function generateRouteFromPath(filePath) {
    // Elimina la extensión ".js"
    let route = filePath.replace(/\.js$/, '');
    // Reemplaza segmentos dinámicos [param] por :param
    route = route.replace(/\[([^\]]+)\]/g, ':$1');

    // Si la ruta termina en "/index", la elimina
    if (route.endsWith('/index')) {
        route = route.slice(0, -('/index'.length));
    }
    // Si la ruta es "index" (la raíz), se convierte en cadena vacía
    if (route === 'index') {
        route = '';
    }

    // Asegúrate de que empiece con "/"
    return '/' + route;
}

function loadApiRoutes(apiFolder = join(process.cwd(), 'src', 'api')) {
    const app = express();
    app.use(express.json());

    function traverseDir(currentPath) {
        const entries = readdirSync(currentPath);
        for (const entry of entries) {
            const fullPath = join(currentPath, entry);
            if (statSync(fullPath).isDirectory()) {
                traverseDir(fullPath);
            } else if (entry.endsWith('.js')) {
                let relPath = relative(join(process.cwd(), 'src', 'api'), fullPath);
                if (relPath.startsWith('routes' + require('path').sep)) {
                    relPath = relPath.substring(('routes' + require('path').sep).length);
                }
                const route = generateRouteFromPath(relPath);

                const fileContent = readFileSync(fullPath, 'utf8');
                const methodMatch = fileContent.match(/Type:\s*(\w+)/i);
                const method = methodMatch ? methodMatch[1].toLowerCase() : 'get';

                const handler = require(fullPath);
                // Si el método existe en express, se usa; de lo contrario se usa GET.
                if (typeof app[method] === 'function') {
                    app[method](route, handler);
                } else {
                    app.get(route, handler);
                }
            }
        }
    }

    traverseDir(apiFolder);
    return app;
}

module.exports = loadApiRoutes;
