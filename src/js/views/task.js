define([
    'jquery',
    'backbone',
    'handlebars',
    'editTaskView',
    'editTaskModel',
    'constants',
    'text!hbs/task-template.hbs'
],function(
    $,
    Backbone,
    Handlebars,
    EditTaskView,
    EditTaskModel,
    constants,
    mainTemplate
) {

    var CSS_CLASSES = constants.task.cssClasses,
        PROPERTIES = constants.task.properties,
        task;

    task = Backbone.View.extend({

        tagName: 'div',

        className: CSS_CLASSES.taskCard,

        events: {
            'click .task-edit-button': 'onTaskEditClick',
            'click .task-delete-button': 'onTaskDeleteClick'
        },

        initialize: function() {
            this.render();

            this.$el.addClass('priority-' + this.model.get(PROPERTIES.priority));

            //this.listenTo(this.model.on('change:modified', this.render.bind(this)));
            this.listenTo(this.model.on('change:modified', _.bind(this.render, this)));
            
            this.listenTo(this.model.on('destroy', _.bind(this.removeView, this)));
        },

        removeView: function() {
            this.remove();
        },

        mainTemplate:  Handlebars.compile(mainTemplate),

        render: function() {
            this.$el.html(this.mainTemplate(this.model.attributes));
            this.placeTaskCard();

            return this;
        },

        placeTaskCard: function() {
            // use constants here
            $('.story-card')
                .filter('[data-story-id="' + this.model.get(PROPERTIES.storyID) + '"]')
                .next('table')
                .find('.status-' + this.model.get(PROPERTIES.status).replace(/\s+/g, ''))
                .append(this.$el);
        },

        onTaskEditClick: function() {
            var editTask = new EditTaskView({
                model: new EditTaskModel({
                    taskModel: this.model
                })
            });
        },

        onTaskDeleteClick: function() {
            var warningMessage = confirm(
                'Are you sure you want to delete the task "' +
                    this.model.get(PROPERTIES.description) +
                    '"?'
            );

            if (warningMessage === true) {
                this.model.destroy();
            } else {
                return;
            }
        }


    });

    return task;

});