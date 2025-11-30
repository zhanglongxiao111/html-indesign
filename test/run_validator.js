const fs = require('fs');
const {validate} = require('../src/validator');

const html = fs.readFileSync('test/output_build/content_free_visual.html', 'utf-8');
const bp = JSON.parse(fs.readFileSync('test/artifacts/real_blueprint_v7.json', 'utf-8'));

const result = validate(html, bp);
console.log(JSON.stringify(result, null, 2));

