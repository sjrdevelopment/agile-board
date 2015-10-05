define(
    [
        'backbone',
        'storiesCollection'
    ],
    function (
        Backbone,
        StoriesCollection
    ) {
        'use strict';

        describe('Stories collection', function() {
            var collection;

            beforeEach(function() {
                collection = new StoriesCollection();
            });

            describe('On initialize', function() {
                it('should inherit from Backbone.Collection', function() {
                    expect(collection instanceof Backbone.Collection).toBe(true);
                });
            });

            describe('On parse', function() {
                var dummyResponseArray = [],
                    expectedReturnArray = [];

                beforeEach(function() {
                    dummyResponseArray = [null, 'a', 'b', null, 'c'];
                    expectedReturnArray = ['a', 'b', 'c'];
                });
                
                it('should remove any null entries in collection data', function() {
                    expect(collection.parse(dummyResponseArray)).toEqual(expectedReturnArray);
                });
            });
        });
    }
);
