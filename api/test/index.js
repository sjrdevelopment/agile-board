var request = require('supertest');
var app = require('../app');

describe('GET /', function() {
  it('should return hello world', function (done) {
    request(app)
      .get('/')
      .expect(200)
      .expect('Content-Type', /html/)
      .expect('Content-Length', '31')
      .expect('<h1>TODO: Implement Board</h1>\n')
      .end(done);
  });
});
