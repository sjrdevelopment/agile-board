"use strict";

var ResponseUtils = function() {};

ResponseUtils.prototype.json = function(res) {
  return function(obj) {
  	//res.header("Access-Control-Allow-Origin", "http://localhost:9000");
    res.json(obj);
  };
};

ResponseUtils.prototype.noContent = function(res) {
  return function() {
  	//res.header("Access-Control-Allow-Origin", "http://localhost:9000");
    res.status(204).send();
  };
};

module.exports = new ResponseUtils();
