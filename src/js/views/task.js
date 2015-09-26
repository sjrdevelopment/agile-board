define([
  'jquery',
  'backbone',
  'handlebars',
  'text!hbs/task-template.hbs'
],function(
  $,
  Backbone,
  Handlebars,
  mainTemplate
) {
  var task = Backbone.View.extend({

      tagName: 'div',
      
      className: 'task-card',

      // The DOM events specific to an item.
      events: {

      },

      initialize: function() {
        console.log('initialise tasks view');

        this.render();
        this.listenTo(this.model.on('change', this.render.bind(this)));


        this.$el.addClass('priority-' + this.model.get("priority"));

        $('.story-card')
          .filter('[data-story-id="' + this.model.get('story_id') + '"]')
          .next('table')
          .find('.status-' + this.model.get('status').replace(/\s+/g, ''))
          .append(this.$el);
      },

      "mainTemplate":  Handlebars.compile(mainTemplate),

      // Re-renders the titles of the todo item.
      render: function() {
        this.$el.html(this.mainTemplate(this.model.attributes));

        return this;
      }
  });

  return task;

});