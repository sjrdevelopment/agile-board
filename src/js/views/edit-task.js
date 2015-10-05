define([
    'jquery',
    'backbone',
    'handlebars',
    'constants',
    'text!hbs/edit-task-template.hbs'
],function(
    $,
    Backbone,
    Handlebars,
    constants,
    mainTemplate
) {

    var GENERIC_CLASSES = constants.genericClasses,
        GENERIC_EVENTS = constants.genericEvents,
        GENERIC_SELECTORS = constants.genericSelectors,
        editTask,
        $html,
        $body;

    EditTask = Backbone.View.extend({
        tagName: 'div',

        className: GENERIC_CLASSES.overlayContent,

        events: {
            'click .save-button': 'saveTaskChanges'
        },

        initialize: function() {
            $html = $('html');
            $body = $('body');

            this.render();
        },

        saveTaskChanges: function() {
            var paramArray = $('form').serializeArray();

            this.model.updateTaskModel(paramArray);

            $html.removeClass(GENERIC_CLASSES.overlayActive);
            $body.off(GENERIC_EVENTS.closeOverlay);
        },

        mainTemplate:  Handlebars.compile(mainTemplate),

        render: function() {
            this.$el.html(this.mainTemplate(this.model.attributes));
            $(GENERIC_SELECTORS.overlay).html(this.$el);
            $html.addClass(GENERIC_CLASSES.overlayActive);

            window.event.stopPropagation();

            $body.on(GENERIC_EVENTS.closeOverlay, function(event) {
                if ($(event.target).closest(GENERIC_SELECTORS.overlay).length === 0 ) {
                    $html.removeClass(GENERIC_CLASSES.overlayActive);
                }
            });

            return this;
        }
    });

    return EditTask;

});