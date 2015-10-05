define(
    [
        'backbone',
        'editStoryModel',
        'storiesCollection',
        'storyModel'
    ],
    function (
        Backbone,
        EditStoryModel,
        StoriesCollection,
        StoryModel
    ) {
        'use strict';

        describe('Edit story model', function() {
            var model,
                mockStoryModel,
                mockStoriesCollection;

            beforeEach(function() {
                mockStoriesCollection = new StoriesCollection();

                mockStoryModel = new StoryModel();

                model = new EditStoryModel({
                        storyModel: mockStoryModel
                    },{
                        storiesCollection: mockStoriesCollection
                    }
                );
            });

            describe('On initialize', function() {

                it('should inherit from Backbone.Model', function() {
                    expect(model instanceof Backbone.Model).toBe(true);
                });

                it('should have set local property for storiesCollection', function() {
                    expect(model.storiesCollection).toEqual(mockStoriesCollection);
                });
            });

            describe('On updateStoryModel', function() {

                beforeEach(function() {
                    spyOn(mockStoryModel, 'syncWithApi');
                    spyOn(mockStoriesCollection, 'add');

                    model.updateStoryModel();
                });

                it('should call passed story model syncWithApi function', function() {
                    expect(mockStoryModel.syncWithApi).toHaveBeenCalled();
                });

                it('should invoke stories collection add with this story model', function() {
                    expect(mockStoriesCollection.add).toHaveBeenCalledWith(mockStoryModel);
                });
            });
        });
    }
);
