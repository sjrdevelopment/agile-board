define(
    [
        'backbone',
        'constants',
        'editTaskView',
        'editTaskModel',
        'jquery',
        'handlebars'
    ],
    function (
        Backbone,
        constants,
        editTaskView,
        editTaskModel,
        $,
        Handlebars
    ) {
        'use strict';

        var PROPERTIES = constants.task.properties,
            GENERIC_CLASSES = constants.genericClasses;

        describe('Edit task view', function() {
            var view;

            beforeEach(function(){
                window.event = {
                    target: 'window',
                    stopPropagation: function() {
                        return true;
                    }
                }
            });

            describe('On initialize', function() {

                beforeEach(function() {

                    view = new editTaskView({
                        model: new editTaskModel()
                    });

                });

                it('should inherit from Backbone.View', function() {
                    expect(view instanceof Backbone.View).toBe(true);
                });

                it('should add html overlay class', function() {
                    expect($('html').hasClass(GENERIC_CLASSES.overlayActive)).toBe(true);
                });
              
            });

            describe('On saveTaskChanges', function() {

                beforeEach(function() {
                    view = new editTaskView({
                        model: new editTaskModel()
                    });

                    spyOn(view.model, 'updateTaskModel');
     
                    view.saveTaskChanges();
                });

                it('should call updateTaskModel with form parameters array', function() {
                    expect(view.model.updateTaskModel).toHaveBeenCalled();
                });
              
                it('should remove html overlay class', function() {
                    expect($('html').hasClass(GENERIC_CLASSES.overlayActive)).toBe(false);
                });
            });

        });
    }
);
