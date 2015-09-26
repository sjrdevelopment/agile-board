define(['jquery', 'backbone'], function($, Backbone) {

	var MainModel = Backbone.Model.extend({

		initialize: function() {
			this.set('name', 'stu');
			debugger;
		}

	});

    return MainModel;
});