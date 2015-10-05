define([
    'jquery',
    'backbone',
    'handlebars',
    'text!hbs/story-template.hbs',
    'editStoryView',
    'editStoryModel',
    'taskModel',
    'taskView',
    'editTaskModel',
    'editTaskView',
    'constants'
],function(
    $,
    Backbone,
    Handlebars,
    mainTemplate,
    EditStoryView,
    EditStoryModel,
    TaskModel,
    TaskView,
    EditTaskModel,
    EditTaskView,
    constants
) {

    var GENERIC_CLASSES = constants.genericClasses,
        GENERIC_EVENTS = constants.genericEvents,
        GENERIC_SELECTORS = constants.genericSelectors,
        CSS_CLASSES = constants.story.cssClasses,
        PROPERTIES = constants.story.properties,
        storyView,
        $html,
        $body;

    storyView = Backbone.View.extend({
        tagName: 'div',

        className: CSS_CLASSES.storyRow,

        events: {
            'click .story-edit-button': 'onStoryEditClick',
            'click .story-delete-button': 'onStoryDeleteClick',
            'click .new-task-button': 'onNewTaskClick'
        },

        initialize: function() {
            $html = $('html');
            $body = $('body');

            // need all of these?
            this.listenTo(this.model.on('change', this.render.bind(this)));
            this.listenTo(this.model.on('destroy', _.bind(this.removeView, this)));
            this.model.on('change:modified', _.bind(this.render, this));
        },

        removeView: function() {
            this.remove();
        },

        onNewTaskClick: function(event) {
            var storyID,
                newTaskModel,
                taskCreator;

            $html.addClass(GENERIC_CLASSES.overlayActive);

            event.stopPropagation();

            $body.on(GENERIC_EVENTS.closeOverlay, function(event) {
                if ( $(event.target).closest(GENERIC_SELECTORS.overlay).length === 0 ) {
                    $html.removeClass(GENERIC_CLASSES.overlayActive);
                    $body.off(GENERIC_EVENTS.closeOverlay);
                }
            });

            storyID = this.model.get(PROPERTIES.idAttribute);

            newTaskModel = new TaskModel({}, {newModel: true});

            taskCreator = new EditTaskView({
                model: new EditTaskModel({
                    taskModel: new TaskModel({
                        story_id: storyID
                    },{
                        newModel: true
                    })
                })
            });
        },

        onStoryEditClick: function() {
            var thisStoryModel,
                editStory;

            thisStoryModel = this.model;

            editStory = new EditStoryView({
                model: new EditStoryModel({
                    storyModel: thisStoryModel
                })
            });
        },

        onStoryDeleteClick: function() {
            var warningMessage = confirm(
                'Are you sure you want to delete the story "As a ' +
                    this.model.get(PROPERTIES.persona) +
                    ' I want to ' +
                    this.model.get(PROPERTIES.feature) +
                    '..."'
            );

            if (warningMessage === true) {
                this.model.destroy();
            } else {
                return;
            }
        },

        mainTemplate:  Handlebars.compile(mainTemplate),

        render: function() {
            this.$el.html(this.mainTemplate(this.model.attributes));

            return this;
        }

    });

  return storyView;

});