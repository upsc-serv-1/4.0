const url = 'https://storage.googleapis.com/eas-workflows-production/logs/d18e4c7f-d293-40af-8a5a-04fd038645d0/d2079db1-ac80-4c4d-a83a-8ec04f395418/2026-07-25T07%3A08%3A19Z-691d076e-d1d0-4a87-8ef2-17827c67fd02.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260725%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260725T070825Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=7c4ae51b83ddb2b03104b6c99cc75dd35bc69c0430875e49bf2dd46687f8bedf401bacfe1a3a61b4ddc70c8f882c085750a9adcde85b2e30d2b0847ba9fea1444b7fa98b105827d378fbc81f07ef1b504047208fa656ceb31c144d5d8d32e2dd7987f1a8d6dafa255c8343483d5fa0652ab368947301dfd61955a6cfdddb346802cf9cb90f70e04f10fb9871b2b9bd867c51a925ac04b438212b5de8301346215da8284df7fe614e2e2f7e6ed801672cb5c94f045e5935c5156ea432abe2cd5db857e93ca2bc906c36dfb8bd9385ab9436168a029709282903dbb1fb38b7a74068b0adf022dc9008a8c70185ec402699f023e49d1015ab598bee99c40f65358e';

fetch(url).then(r=>r.text()).then(t => {
  const lines = t.split('\n');
  const eagerIdx = lines.findIndex(l => l.includes('Import stack:'));
  if (eagerIdx !== -1) {
    console.log('--- LOG BEFORE IMPORT STACK ---');
    console.log(lines.slice(Math.max(0, eagerIdx - 50), eagerIdx + 5).map(l => {
      try {
        const obj = JSON.parse(l);
        return obj.msg || '';
      } catch (e) {
        return l;
      }
    }).filter(Boolean).join('\n'));
  }
});
