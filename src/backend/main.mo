import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Map "mo:core/Map";
import Time "mo:core/Time";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";



actor {
  include MixinStorage();

  type Resolution = {
    width : Nat;
    height : Nat;
  };

  type Photo = {
    id : Text;
    title : Text;
    timestamp : Time.Time;
    resolution : Resolution;
    blob : Storage.ExternalBlob;
  };

  module Photo {
    public func compare(p1 : Photo, p2 : Photo) : Order.Order {
      Text.compare(p1.title, p2.title);
    };
  };

  let photos = Map.empty<Text, Photo>();

  // Save a photo
  public shared ({ caller }) func savePhoto(title : Text, resolution : Resolution, blob : Storage.ExternalBlob) : async Text {
    let id = title.concat(" - ").concat(Time.now().toText());
    let photo : Photo = {
      id;
      title;
      timestamp = Time.now();
      resolution;
      blob;
    };

    photos.add(id, photo);
    id;
  };

  // List all photos
  public query ({ caller }) func listPhotos() : async [Photo] {
    photos.values().toArray().sort();
  };

  // Get a specific photo
  public query ({ caller }) func getPhoto(id : Text) : async Photo {
    switch (photos.get(id)) {
      case (null) { Runtime.trap("Photo not found") };
      case (?photo) { photo };
    };
  };

  // Delete a photo
  public shared ({ caller }) func deletePhoto(id : Text) : async () {
    switch (photos.get(id)) {
      case (null) { Runtime.trap("Photo not found") };
      case (?_) {
        photos.remove(id);
      };
    };
  };

  // Search photos by title
  public query ({ caller }) func searchPhotos(searchTerm : Text) : async [Photo] {
    let filtered = photos.values().filter(
      func(p) {
        p.title.toLower().contains(#text(searchTerm.toLower()));
      }
    );
    filtered.toArray();
  };
};
