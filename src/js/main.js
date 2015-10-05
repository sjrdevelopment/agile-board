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
    'constants',
    'handlebars'
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
    constants,
    Handlebars
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


    Handlebars.registerHelper('select', function( value, options ){
        var $el = $('<select />').html( options.fn(this) );
        $el.find('[value="' + value + '"]').attr({'selected':'selected'});
        return $el.html();
    });


    stories = new StoriesCollection();
    tasks = new TasksCollection();

    addItemView = function(modelAdded) {
        var view = new StoryView({model: modelAdded});

        $(GENERIC_SELECTORS.board).append( view.render().el );
    };

    addTaskView = function(modelAdded) {
        var view = new TaskView({model: modelAdded});
    };

    showError = function(error) {
        console.log(error);
    };

    stories.on('add', addItemView, this);
    tasks.on('add', addTaskView, this);

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