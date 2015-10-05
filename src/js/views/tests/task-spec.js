define(
    [
        'jquery',
        'backbone',
        'constants',
        'taskView',
        'taskModel'
    ],
    function (
        $,
        Backbone,
        constants,
        TaskView,
        TaskModel
    ) {
        'use strict';

        var GENERIC_CLASSES = constants.genericClasses;

        describe('Task view', function() {
           var view;

            describe('On initialize', function() {
                beforeEach(function() {

                    view = new TaskView({
                        model: new TaskModel({
                            status: 'in progress'
                        })
                    });

                });

                it('should inherit from Backbone.View', function() {
                    expect(view instanceof Backbone.View).toBe(true);
                });

                it('should populate markup for view.$el', function() {
                    expect(_.isEmpty(view.$el)).toBe(false);
                });
            });

            describe('onTaskDeleteClick function', function() {
                beforeEach(function() {
                    //mock a confirm box clicking ok
                    spyOn(window, 'confirm').and.returnValue(true);
                    spyOn(view.model, 'destroy');

                    view.onTaskDeleteClick();
                });

                it('should call window confirm function', function() {
                    expect(window.confirm).toHaveBeenCalled();
                });

                it('should destroy this model on confirm returning true', function() {
                    expect(view.model.destroy).toHaveBeenCalled();
                });

              
            });


        });
    }
);
