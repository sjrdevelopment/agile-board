define([
  'jquery',
  'underscore',
  'backbone',
  'handlebars',
  'text!hbs/edit-task-template.hbs'
],function(
  $,
  _,
  Backbone,
  Handlebars,
  mainTemplate
) {
  var editTask = Backbone.View.extend({

      tagName: 'div',

      className: 'overlay-content',
      // The DOM events specific to an item.
      events: {
        "click .save-button": "saveTaskChanges"
      },

      initialize: function() {
        debugger;
        this.render();
       
      },

      saveTaskChanges: function() {
        var paramArray = $('form').serializeArray();

        debugger;
        this.model.updateTaskModel(paramArray);

        $('html').removeClass('overlay-active');
        $('body').off('click:closeOverlay');

      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        this.$el.html(this.mainTemplate(this.model.attributes));
        $('.overlay').html(this.$el);
        $('html').addClass('overlay-active');
        debugger;
        //window.stopPropagation();

        /*$('body').on('click:closeOverlay', function(event) {
          if ( $(event.target).closest('.overlay').length === 0 ) {
              $('html').removeClass('overlay-active');
          } 
        });
*/
        return this;
      }
  });

  return editTask;

});