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
  var storyView = Backbone.View.extend({

      tagName: 'div',
      
      className: 'story-row',

      // The DOM events specific to an item.
      events: {
        "click .story-edit-button": "onStoryEditClick",
        "click .story-delete-button": "onStoryDeleteClick"
      },

      initialize: function() {
        console.log('initialise view');
        // this.render();

        // check this?
        this.listenTo(this.model.on('change', this.render.bind(this))); 
        
        this.listenTo(this.model.on('destroy', _.bind(this.removeView, this)));

        window.myModel = this.model;


        this.model.on('change:modified', _.bind(this.render, this));

      },

      removeView: function() {
        this.remove();
      },


      onStoryEditClick: function() {
     
        var thisStoryModel = this.model;

        var editStory = new EditStoryView({
          model: new EditStoryModel({
            storyModel: thisStoryModel
          })
        });
      },

      onStoryDeleteClick: function() {
     
        this.model.destroy();
      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
   
        this.$el.html(this.mainTemplate(this.model.attributes));

        return this;
      }
  });

  return storyView;

});