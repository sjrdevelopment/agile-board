require([
    'jquery',
    'backbone',
    'storyView',
    'storyModel',
    'storiesCollection',
    'tasksCollection',
    'taskView',
    'editStoryView',
    'editStoryModel',
    'constants'
], function (
    $,
    Backbone,
    StoryView,
    StoryModel,
    StoriesCollection,
    TasksCollection,
    TaskView,
    EditStoryView,
    EditStoryModel,
    constants
) {
    var stories,
        tasks,
        addItemView,
        showError,
        GENERIC_CLASSES = constants.genericClasses,
        GENERIC_EVENTS = constants.genericEvents,
        GENERIC_SELECTORS = constants.genericSelectors,
        $html = $('html'),
        $body = $('body');

    Backbone.history.start();

    stories = new StoriesCollection();
    tasks = new TasksCollection();

    addItemView = function(modelAdded) {
        var view = new StoryView({model: modelAdded});

        $(GENERIC_SELECTORS.board).append( view.render().el );
    };

    showError = function(error) {
        console.log(error);
    };

    stories.on('add', addItemView, this);
 
    stories.fetch({
        error: showError
    }).done(function(){
        tasks.fetch({
            error: showError
        });
    });
    

    $(GENERIC_SELECTORS.addStoryButton).on('click', function(event) {
        var newStoryModel,
            editStory;

        $html.addClass(GENERIC_CLASSES.overlayActive);
        event.stopPropagation();

        $body.on(GENERIC_EVENTS.closeOverlay, function(event) {
            if ($(event.target).closest(GENERIC_SELECTORS.overlay).length === 0 ) {
                $html.removeClass(GENERIC_CLASSES.overlayActive);
                $body.off(GENERIC_EVENTS.closeOverlay);
            } 
        });
        
        newStoryModel = new StoryModel({}, {newModel: true});

        editStory = new EditStoryView({
            model: new EditStoryModel({
                storyModel: newStoryModel
            }, {
                storiesCollection: stories
            }
          )
        });
    });
});