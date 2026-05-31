const test = require('node:test');
const assert = require('node:assert/strict');
const { uncToNasUrl, toBrowserAssetPath } = require('../../src/shared/nas-paths');

test('uncToNasUrl converts host-name UNC paths to HTMLHub NAS URLs', () => {
  assert.equal(
    uncToNasUrl('\\\\daga-nas5\\daga-2025-project\\D0474_大兴城建\\图纸 A.pdf'),
    '/nas/daga-nas5/daga-2025-project/D0474_%E5%A4%A7%E5%85%B4%E5%9F%8E%E5%BB%BA/%E5%9B%BE%E7%BA%B8%20A.pdf'
  );
});

test('uncToNasUrl preserves existing NAS gateway paths', () => {
  assert.equal(uncToNasUrl('/nas/daga-nas5/share/a.png'), '/nas/daga-nas5/share/a.png');
});

test('uncToNasUrl canonicalizes existing NAS gateway host names', () => {
  assert.equal(uncToNasUrl('/nas/Daga-nas5/share/a.png'), '/nas/daga-nas5/share/a.png');
});

test('uncToNasUrl converts slash UNC paths without requiring mapped drives', () => {
  assert.equal(uncToNasUrl('//Daga-nas5/share/a b.png'), '/nas/daga-nas5/share/a%20b.png');
});

test('uncToNasUrl canonicalizes UNC host names for Linux NAS gateways', () => {
  assert.equal(
    uncToNasUrl('\\\\Daga-nas5\\daga-2025-project\\D0474_大兴城建\\02-2D\\rendering\\image.png'),
    '/nas/daga-nas5/daga-2025-project/D0474_%E5%A4%A7%E5%85%B4%E5%9F%8E%E5%BB%BA/02-2D/rendering/image.png'
  );
});

test('toBrowserAssetPath keeps relative package paths unchanged', () => {
  assert.equal(toBrowserAssetPath('../assets/a b.png'), '../assets/a b.png');
});
