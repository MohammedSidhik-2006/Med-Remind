const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../node_modules/react-scripts/config/webpackDevServer.config.js');

if (fs.existsSync(targetPath)) {
  let content = fs.readFileSync(targetPath, 'utf8');
  
  if (content.includes('onBeforeSetupMiddleware') || content.includes('onAfterSetupMiddleware')) {
    console.log('Patching react-scripts webpackDevServer.config.js to resolve middleware deprecation warnings...');
    
    const pattern = /onBeforeSetupMiddleware[\s\S]*?onAfterSetupMiddleware\s*\(devServer\)\s*\{[\s\S]*?\},/;
    
    const replacement = `setupMiddlewares(middlewares, devServer) {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      devServer.app.use(evalSourceMapMiddleware(devServer));

      if (fs.existsSync(paths.proxySetup)) {
        require(paths.proxySetup)(devServer.app);
      }

      devServer.app.use(redirectServedPath(paths.publicUrlOrPath));
      devServer.app.use(noopServiceWorkerMiddleware(paths.publicUrlOrPath));

      return middlewares;
    },`;

    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      fs.writeFileSync(targetPath, content, 'utf8');
      console.log('Successfully patched webpackDevServer.config.js!');
    } else {
      console.log('Could not find standard onBeforeSetupMiddleware structure in webpackDevServer.config.js.');
    }
  } else {
    console.log('webpackDevServer.config.js is already patched or does not contain deprecated onBeforeSetupMiddleware.');
  }
} else {
  console.log('react-scripts webpackDevServer.config.js not found (skipping patch).');
}
