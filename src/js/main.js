require(['jquery', 'underscore', 'backbone', 'storyView', 'storiesCollection', 'tasksCollection', 'taskView'], function ($, _, Backbone, StoryView, StoriesCollection, TasksCollection, TaskView) {
	var stories = new StoriesCollection();
	var tasks = new TasksCollection();

	var renderStoryViews = function() {
     
      _.each(stories.models, function(storyModel, index) {

        var view = new StoryView({model: storyModel});

        $('.board').append( view.render().el );
      });
    };

    var renderTaskViews = function() {
     
      _.each(tasks.models, function(taskModel, index) {

        var view = new TaskView({model: taskModel});

        //$('.tasks').append( view.render().el );
      });
    };

    var showError = function(error) {
    	console.log(error);
    };

 
	stories.fetch({
        success: renderStoryViews,
        error: showError
    }).done(function(){
    	tasks.fetch({
	        success: renderTaskViews,
	        error: showError
	    });
    });

    $('.add-story-button').on('click', function(){
    	$('html').addClass('overlay-active');

    	// create new view for modal

    		// append view $el to .overlay
    })
	
	
});