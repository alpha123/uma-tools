use strict;
use warnings;
use v5.28;
use utf8;

use Cwd 'abs_path';
use File::Basename;
use File::Copy;
use File::Path qw(make_path);
use DBI;
use DBD::SQLite::Constants qw(:file_open);

if (!@ARGV) {
	die 'Usage: extract_resource.pl meta <query>';
}

my $meta = shift @ARGV;
my $root = dirname(abs_path($meta));
my $datadir = $root . "/dat";

my $query = shift @ARGV;

my $metadb = DBI->connect("dbi:SQLite:$meta", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$metadb->{RaiseError} = 1;

# work around windows quoting issues (just use ^ as a quote instead)
$query =~ s/\^/"/g;

say "SELECT h FROM a WHERE n LIKE \"$query\";";

my $select = $metadb->prepare("SELECT h FROM a WHERE n LIKE \"$query\";");

my $hash;

# make sure need_unpack directory exists
unless (-d 'need_unpack') {
	make_path('need_unpack') or die "Failed to create need_unpack: $!";
}

$select->execute;
$select->bind_columns(\($hash));

while ($select->fetch) {
	$hash =~ /^(..)/;
	my $hdir = $1;
	copy("$datadir/$hdir/$hash", "need_unpack/$hash");
}
