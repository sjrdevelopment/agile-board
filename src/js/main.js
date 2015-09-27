require([
    'jquery',
    'underscore',
    'backbone',
    'storyView',
    'storyModel',
    'storiesCollection',
    'tasksCollection',
    'taskView',
    'editStoryView',
    'editStoryModel'
], function (
    $,
    _,
    Backbone,
    StoryView,
    StoryModel,
    StoriesCollection,
    TasksCollection,
    TaskView,
    EditStoryView,
    EditStoryModel
) {
	Backbone.history.start();

    var stories = new StoriesCollection();
	var tasks = new TasksCollection();


    

    var addItemView = function(modelAdded) {
    
        var view = new StoryView({model: modelAdded});

        $('.board').append( view.render().el );
    };

    stories.on("add", addItemView, this);

	var renderStoryViews = function() {
     
      //_.each(stories.models, function(storyModel, index) {

       // var view = new StoryView({model: storyModel});

      //  $('.board').append( view.render().el ); //need to render()?
      //});
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

    $('.add-story-button').on('click', function(event){
    	$('html').addClass('overlay-active');
    	event.stopPropagation();

    	$('body').on('click:rem', function(event) {
    		if ( $(event.target).closest('.overlay').length === 0 ) {
		        $('html').removeClass('overlay-active');
                $('body').off('click:rem');
		    } 
    	});
        
    	// create new view for modal
        /*
        var newStory = new StoryView({
            model: new StoryModel({}, {newModel: true})
        });
        */

        var newStoryModel = new StoryModel({}, {newModel: true});

        var editStory = new EditStoryView({
          model: new EditStoryModel({
                storyModel: newStoryModel
            }, {
                storiesCollection: stories
            }
          )
        });





    		// append view $el to .overlay
    });
	
	
});