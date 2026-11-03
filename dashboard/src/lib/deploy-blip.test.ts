/**
 * Deploy-blip detection — run: npx tsx dashboard/src/lib/deploy-blip.test.ts
 */
import assert from 'node:assert/strict';
import { translate } from './i18n.tsx';
import {
  deployBlipMatchesClientRing,
  formatUserFacingApiError,
  isAxiosStatusMessage,
  isDeployBlip,
  isHtmlErrorBody,
  resetDeployBlipStateForTests,
  shouldSkipDeployToastForRequest,
  systemUpdateMessage,
} from './deploy-blip.ts';

resetDeployBlipStateForTests();

assert.equal(isHtmlErrorBody('<!DOCTYPE html><html><body>502 Bad Gateway</body></html>'), true);
assert.equal(isHtmlErrorBody('<html><head><title>503 Service Unavailable</title></head></html>'), true);
assert.equal(isHtmlErrorBody('{"error":"Customer email invalid"}'), false);
assert.equal(isHtmlErrorBody(''), false);
assert.equal(isHtmlErrorBody(undefined), false);

assert.equal(isDeployBlip({ response: { status: 502, data: '' } }), true);
assert.equal(isDeployBlip({ response: { status: 503, data: { error: 'upstream' } } }), true);
assert.equal(isDeployBlip({ response: { status: 504 } }), true);
assert.equal(
  isDeployBlip({
    response: {
      status: 200,
      data: '<!DOCTYPE html><html>index</html>',
      headers: { 'content-type': 'text/html' },
    },
  }),
  true
);
assert.equal(
  isDeployBlip({
    response: { status: 500, data: '<html><body>Bad Gateway</body></html>' },
  }),
  true
);
assert.equal(isDeployBlip({ code: 'ERR_NETWORK', message: 'Network Error' }), true);
assert.equal(isDeployBlip({ message: 'Failed to fetch' }), true);
assert.equal(isDeployBlip({ code: 'ECONNABORTED' }), false);

assert.equal(isDeployBlip({ response: { status: 401, data: { error: 'Unauthorized' } } }), false);
assert.equal(isDeployBlip({ response: { status: 403, data: { error: 'Forbidden' } } }), false);
assert.equal(isDeployBlip({ response: { status: 422, data: { error: 'Invalid email' } } }), false);
assert.equal(isDeployBlip({ response: { status: 400, data: { error: 'Name required' } } }), false);
assert.equal(
  isDeployBlip({ response: { status: 500, data: { error: 'Failed to load customers' } } }),
  false
);
assert.equal(isDeployBlip(null), false);
assert.equal(isDeployBlip('boom'), false);

assert.equal(shouldSkipDeployToastForRequest({ config: { url: '/auth/merchant/login' } }), true);

assert.equal(
  deployBlipMatchesClientRing({ response: { headers: { 'x-reborn-deploy-ring': 'production' } } }),
  true
);
assert.equal(
  deployBlipMatchesClientRing({ response: { headers: { 'x-reborn-deploy-ring': 'staging' } } }),
  false
);

assert.equal(
  translate('en', 'systemUpdateWait'),
  'Server temporarily unavailable. Please try again in a moment.'
);
assert.equal(
  translate('fr', 'systemUpdateWait'),
  'Serveur temporairement indisponible. Réessayez dans un instant.'
);
assert.equal(
  translate('de', 'systemUpdateWait'),
  'Server vorübergehend nicht erreichbar. Bitte gleich erneut versuchen.'
);
assert.equal(
  systemUpdateMessage('en'),
  'Server temporarily unavailable. Please try again in a moment.'
);
assert.equal(isAxiosStatusMessage('Request failed with status code 502'), true);
assert.equal(
  formatUserFacingApiError(
    { response: { status: 502 }, message: 'Request failed with status code 502' },
    'Could not load settings.'
  ),
  'Server temporarily unavailable. Please try again in a moment.'
);
assert.equal(
  formatUserFacingApiError(
    { response: { status: 500, data: { error: 'Failed to load customers' } } },
    'Fallback'
  ),
  'Failed to load customers'
);
assert.equal(
  formatUserFacingApiError(
    { response: { status: 500 }, message: 'Request failed with status code 500' },
    'Fallback'
  ),
  "We couldn't reach the server right now. Please wait a moment and try again."
);
assert.equal(translate('en', 'poweredBy'), 'Powered by:');
assert.equal(translate('fr', 'poweredBy'), 'Propulsé par :');

console.log('deploy-blip.test.ts OK');
