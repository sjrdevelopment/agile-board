require(['jquery', 'underscore', 'backbone', 'mainView', 'mainModel'], function ($, _, Backbone, MainView, MainModel) {

	var mainView = new MainView({
		model: new MainModel()
	});

});