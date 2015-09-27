define([
  'jquery',
  'underscore',
  'backbone',
  'handlebars',
  'text!hbs/edit-story-template.hbs'
],function(
  $,
  _,
  Backbone,
  Handlebars,
  mainTemplate
) {
  var editStory = Backbone.View.extend({

      tagName: 'div',

      className: 'overlay-content',
      // The DOM events specific to an item.
      events: {
        "click .save-button": "saveStoryChanges"
      },

      initialize: function() {

        this.render();
       

      },

      saveStoryChanges: function() {
        var paramArray = $('form').serializeArray();

        this.model.updateStoryModel(paramArray);

        $('html').removeClass('overlay-active');
        $('body').off('click:closeOverlay');

      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        this.$el.html(this.mainTemplate(this.model.attributes));
        $('.overlay').html(this.$el);
        $('html').addClass('overlay-active');

        //window.stopPropagation();

        $('body').on('click:closeOverlay', function(event) {
          if ( $(event.target).closest('.overlay').length === 0 ) {
              $('html').removeClass('overlay-active');
          } 
        })
        return this;
      }
  });

  return editStory;

});