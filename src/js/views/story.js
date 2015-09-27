define([
  'jquery',
  'backbone',
  'handlebars',
  'text!hbs/story-template.hbs',
  'editStoryView',
  'editStoryModel'
],function(
  $,
  Backbone,
  Handlebars,
  mainTemplate,
  EditStoryView,
  EditStoryModel
) {
  var story = Backbone.View.extend({

      tagName: 'div',
      
      className: 'story-row',

      // The DOM events specific to an item.
      events: {
        "click .story-edit-button": "onStoryEditClick"
      },

      initialize: function() {
        console.log('initialise view');
       // this.render();
        this.listenTo(this.model.on('change', this.render.bind(this)));

        window.myModel = this.model;

      },

      onStoryEditClick: function() {
        var editStory = new EditStoryView({
          model: new EditStoryModel({
            storyModel: this.model
          })
        });
      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        this.$el.html(this.mainTemplate(this.model.attributes));

        return this;
      }
  });

  return story;

});